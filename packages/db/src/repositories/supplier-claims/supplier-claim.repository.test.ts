import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { AppError, money } from "@easyrms/core";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmReturnRepository } from "../returns/return.repository";
import { MikroOrmSupplierClaimRepository } from "./supplier-claim.repository";
import { MikroOrmSupplierRepository } from "../suppliers/supplier.repository";

let db: TestDatabase;
let agentId: number;
let otherAgentId: number;
let supplierId: number;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
  [{ id: agentId }] = await db.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('a@example.com', 'Ula Testowa', 'active', now(), now()) returning "id"`,
  );
  [{ id: otherAgentId }] = await db.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('b@example.com', 'Olek Drugi', 'active', now(), now()) returning "id"`,
  );
  supplierId = (await new MikroOrmSupplierRepository({ em: db.fork() }).create({ name: "Alfa", email: "claims@alfa.example", guidelines: null })).id;
});

afterAll(async () => {
  await db?.close();
});

const claims = () => new MikroOrmSupplierClaimRepository({ em: db.fork() });

async function complaint(order: string): Promise<number> {
  const created = await new MikroOrmReturnRepository({ em: db.fork(), logger: { error: () => undefined } }).createWithItems({
    orderNumber: order,
    customerEmail: "c@example.com",
    kind: "complaint",
    items: [{ lineRef: "L1", sku: "S", name: "Kettle", quantity: 1, unitPrice: money(19990), reasonCode: "defective" }],
    resolution: "repair",
    resolutionAmount: null,
    returnMethod: "courier",
    idempotencyKey: randomUUID(),
    defectDescription: "The heating element stopped working.",
    defectDiscoveredOn: "2026-10-20",
  });
  return created.id;
}

const newClaim = async (order: string) =>
  claims().create({ returnRequestId: await complaint(order), supplierId, subject: "Reklamacja", body: "Treść", agentId });

describe("create", () => {
  it("writes a draft with a reference and a created event", async () => {
    const claim = await newClaim("SC-1");
    expect(claim).toMatchObject({ status: "draft", subject: "Reklamacja", body: "Treść", createdByAgentId: agentId, sentAt: null, creditAmount: null });
    expect(claim.ref).toMatch(/^SC-\d{4}-\d{5}$/);
    const detail = await claims().findDetail(claim.id);
    expect(detail?.events).toMatchObject([{ type: "created", toStatus: "draft", agentName: "Ula Testowa" }]);
    expect(detail?.claim).toMatchObject({ supplierName: "Alfa", supplierEmail: "claims@alfa.example" });
    expect(detail?.claim.rma).toMatch(/^RMA-/);
  });

  it("hands out distinct references to concurrent creates", async () => {
    const ids = await Promise.all(Array.from({ length: 4 }, (_, i) => complaint(`SC-C-${i}`)));
    const created = await Promise.all(ids.map((returnRequestId) => claims().create({ returnRequestId, supplierId, subject: "S", body: "B", agentId })));
    expect(new Set(created.map((claim) => claim.ref)).size).toBe(4);
  });

  it("allows one claim per complaint and answers 409 claim_exists for a second", async () => {
    const returnRequestId = await complaint("SC-2");
    await claims().create({ returnRequestId, supplierId, subject: "S", body: "B", agentId });
    const error = await claims().create({ returnRequestId, supplierId, subject: "S2", body: "B2", agentId: otherAgentId }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 409, code: "claim_exists" });
    expect((await claims().findByReturnRequest(returnRequestId))?.subject).toBe("S");
  });
});

describe("transition", () => {
  it("walks the path, recording sent, answered and credited times and the acting agent", async () => {
    const claim = await newClaim("SC-3");
    const sent = await claims().transition(claim.id, "draft", "sent", agentId);
    expect(sent).toMatchObject({ result: "moved", claim: { status: "sent" } });
    expect(sent.result === "moved" && sent.claim.sentAt).toBeInstanceOf(Date);

    const accepted = await claims().transition(claim.id, "sent", "accepted", otherAgentId, { note: "Uznajemy", creditAmount: money(15000) });
    expect(accepted).toMatchObject({ result: "moved", claim: { status: "accepted", answerNote: "Uznajemy", creditAmount: { amountMinor: 15000 } } });

    await claims().transition(claim.id, "accepted", "credited", agentId);
    const detail = await claims().findDetail(claim.id);
    expect(detail?.claim).toMatchObject({ status: "credited" });
    expect(detail?.claim.creditedAt).toBeInstanceOf(Date);
    expect(detail?.claim.answeredAt).toBeInstanceOf(Date);
    expect(detail?.events.map((e) => [e.toStatus, e.agentName])).toEqual([
      ["draft", "Ula Testowa"],
      ["sent", "Ula Testowa"],
      ["accepted", "Olek Drugi"],
      ["credited", "Ula Testowa"],
    ]);
  });

  it("records a rejection with its reason and no amount", async () => {
    const claim = await newClaim("SC-4");
    await claims().transition(claim.id, "draft", "sent", agentId);
    const rejected = await claims().transition(claim.id, "sent", "rejected", agentId, { note: "Uszkodzenie mechaniczne po stronie klienta" });
    expect(rejected).toMatchObject({ result: "moved", claim: { status: "rejected", creditAmount: null, answerNote: "Uszkodzenie mechaniczne po stronie klienta" } });
  });

  it("lets only one of two racing agents record the answer", async () => {
    const claim = await newClaim("SC-5");
    await claims().transition(claim.id, "draft", "sent", agentId);
    const results = await Promise.all([
      claims().transition(claim.id, "sent", "accepted", agentId, { note: null, creditAmount: money(100) }),
      claims().transition(claim.id, "sent", "rejected", otherAgentId, { note: "Odrzucone przez dostawcę" }),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual(["conflict", "moved"]);
    const detail = await claims().findDetail(claim.id);
    expect(detail?.events.filter((e) => e.toStatus === "accepted" || e.toStatus === "rejected")).toHaveLength(1);
  });

  it("reports a stale status and an unknown claim", async () => {
    const claim = await newClaim("SC-6");
    expect(await claims().transition(claim.id, "sent", "accepted", agentId)).toEqual({ result: "conflict", currentStatus: "draft" });
    expect(await claims().transition(999999, "draft", "sent", agentId)).toEqual({ result: "not_found" });
  });
});

describe("list", () => {
  it("lists newest first with the vendor and the RMA, and filters by status", async () => {
    const claim = await newClaim("SC-7");
    await claims().transition(claim.id, "draft", "sent", agentId);
    const sent = await claims().list({ status: "sent" });
    expect(sent.every((c) => c.status === "sent")).toBe(true);
    expect(sent.map((c) => c.id)).toContain(claim.id);
    const all = await claims().list();
    expect(all[0]?.id).toBeGreaterThanOrEqual(all[all.length - 1]?.id ?? 0);
    expect(all[0]).toMatchObject({ supplierName: "Alfa" });
  });
});

describe("Migration20261025200000", () => {
  it("rolls back while empty and refuses once a claim exists", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      await database.migrateDown(MIGRATIONS.suppliers);
      expect(await database.query(`select to_regclass('supplier_claims') as "t"`)).toEqual([{ t: null }]);
      expect(await database.query(`select to_regclass('supplier_claim_seq') as "t"`)).toEqual([{ t: null }]);

      await database.migrateUp();
      const [{ id: agent }] = await database.query<{ id: number }>(
        `insert into "agents" ("email", "display_name", "created_at", "updated_at") values ('x@example.com', 'X', now(), now()) returning "id"`,
      );
      const [{ id: supplier }] = await database.query<{ id: number }>(
        `insert into "suppliers" ("name", "email", "created_at", "updated_at") values ('S', 's@x.pl', now(), now()) returning "id"`,
      );
      const [{ id: request }] = await database.query<{ id: number }>(
        `insert into "return_requests" ("order_number", "customer_email", "rma", "kind", "created_at", "updated_at") values ('O', 'c@x.pl', 'RMA-2026-00001', 'complaint', now(), now()) returning "id"`,
      );
      await database.query(
        `insert into "supplier_claims" ("ref", "return_request_id", "supplier_id", "subject", "body", "created_by_agent_id", "created_at", "updated_at") values ('SC-2026-00001', ?, ?, 's', 'b', ?, now(), now())`,
        [request, supplier, agent],
      );
      await expect(database.migrateDown(MIGRATIONS.suppliers)).rejects.toThrow(/Refusing to roll back/);
    } finally {
      await database.close();
    }
  });
});
