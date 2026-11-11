import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { money, type NewEvidenceFile, type NewReturnRequest } from "@easyrms/core";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmEvidenceRepository } from "../evidence/evidence.repository";
import { MikroOrmReturnRepository } from "../returns/return.repository";
import { MikroOrmRetentionRepository } from "./retention.repository";

let db: TestDatabase;
let agentId: number;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
  [{ id: agentId }] = await db.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('a@example.com', 'Ula Agentka', 'active', now(), now()) returning "id"`,
  );
});

afterAll(async () => {
  await db?.close();
});

const retention = (): MikroOrmRetentionRepository => new MikroOrmRetentionRepository({ em: db.fork() });
const evidence = (): MikroOrmEvidenceRepository => new MikroOrmEvidenceRepository({ em: db.fork() });
const LONG_AGO = new Date("2000-01-01T00:00:00Z");
const LIMITS = { maxFilesPerRequest: 6, maxBytesPerOrder: 100_000 };
const CUTOFF = new Date("2026-01-01T00:00:00Z");
const OLD = "2025-06-01T00:00:00Z";
const RECENT = "2026-06-01T00:00:00Z";

function file(order: string): NewEvidenceFile {
  const data = new Uint8Array(100).fill(7);
  data[0] = 0xff;
  return { orderNumber: order, contentType: "image/jpeg", data, sha256: createHash("sha256").update(data).digest("hex"), label: "photo.jpg" };
}

/** A transport request with a photo, an item comment and a decision note; its events are dated `closedAt`. */
async function seed(order: string, status: string, closedAt: string): Promise<{ id: number; rma: string; fileId: string }> {
  const input: NewReturnRequest = {
    orderNumber: order,
    customerEmail: "customer@example.com",
    kind: "transport",
    items: [{ lineRef: "L1", sku: "S", name: "Kettle", quantity: 1, unitPrice: money(1000), reasonCode: "damaged_in_transit", comment: "Dented lid" }],
    resolution: "replacement",
    resolutionAmount: null,
    returnMethod: null,
    idempotencyKey: randomUUID(),
    defectDescription: "The box was crushed.",
    defectDiscoveredOn: "2026-11-04",
  };
  const created = await new MikroOrmReturnRepository({ em: db.fork(), logger: { error: () => undefined } }).createWithItems(input);
  const staged = await evidence().stage(file(order), LIMITS, LONG_AGO);
  if (staged.result !== "stored") throw new Error("stage failed");
  await evidence().attach(order, [staged.file.id], created.id);
  await db.query(`update "return_requests" set "status" = ?, "reason" = 'old reason', "decision_note" = 'agent note', "exchange_note" = 'swap' where "id" = ?`, [status, created.id]);
  await db.query(`update "return_request_events" set "created_at" = ?, "note" = 'event note' where "return_request_id" = ?`, [closedAt, created.id]);
  const [{ rma }] = await db.query<{ rma: string }>(`select "rma" from "return_requests" where "id" = ?`, [created.id]);
  return { id: created.id, rma, fileId: staged.file.id };
}

const count = async (sql: string, params: unknown[] = []): Promise<number> => Number((await db.query<{ n: string }>(sql, params))[0]?.n);

describe("findDue", () => {
  it("returns closed requests older than the cutoff, and nothing else", async () => {
    const old = await seed("RT-1", "resolved", OLD);
    const recent = await seed("RT-2", "resolved", RECENT);
    const open = await seed("RT-3", "submitted", OLD);
    const rejected = await seed("RT-4", "rejected", OLD);
    const due = (await retention().findDue(CUTOFF, 100, 0)).map((row) => row.id);
    expect(due).toContain(old.id);
    expect(due).toContain(rejected.id);
    expect(due).not.toContain(recent.id);
    expect(due).not.toContain(open.id);
  });

  it("pages by id and skips an anonymized request", async () => {
    const first = await seed("RT-5", "resolved", OLD);
    const second = await seed("RT-6", "resolved", OLD);
    await retention().anonymize(first.id);
    const due = await retention().findDue(CUTOFF, 100, 0);
    expect(due.map((row) => row.id)).not.toContain(first.id);
    expect((await retention().findDue(CUTOFF, 1, second.id - 1))[0]?.id).toBe(second.id);
  });
});

describe("anonymize", () => {
  it("removes files, audit rows and personal text, and keeps the facts", async () => {
    const seeded = await seed("RT-7", "resolved", OLD);
    expect(await retention().anonymize(seeded.id)).toEqual({ files: 1, auditRows: 1 });

    expect(await count(`select count(*) as n from "evidence_files" where "return_request_id" = ?`, [seeded.id])).toBe(0);
    expect(await count(`select count(*) as n from "evidence_audit_events" where "evidence_file_id" = ?`, [seeded.fileId])).toBe(0);
    const [row] = await db.query<Record<string, unknown>>(`select * from "return_requests" where "id" = ?`, [seeded.id]);
    expect(row).toMatchObject({
      customer_email: `erased-${seeded.rma}@anonymized.invalid`,
      reason: null,
      defect_description: null,
      exchange_note: null,
      decision_note: null,
      order_number: "RT-7",
      status: "resolved",
    });
    expect(row.anonymized_at).not.toBeNull();
    const [item] = await db.query<{ comment: string | null; sku: string }>(`select "comment", "sku" from "return_request_items" where "return_request_id" = ?`, [seeded.id]);
    expect(item).toEqual({ comment: null, sku: "S" });
    expect(await count(`select count(*) as n from "return_request_events" where "return_request_id" = ? and "note" is not null`, [seeded.id])).toBe(0);
    expect(await count(`select count(*) as n from "return_request_events" where "return_request_id" = ?`, [seeded.id])).toBeGreaterThan(0);
  });

  it("shows the erasure to the agent read model, and the photo download finds nothing", async () => {
    const seeded = await seed("RT-7B", "resolved", OLD);
    const reads = (): MikroOrmReturnRepository => new MikroOrmReturnRepository({ em: db.fork(), logger: { error: () => undefined } });
    expect((await reads().listByOrder("RT-7B"))[0]?.anonymizedAt).toBeNull();
    await retention().anonymize(seeded.id);
    const [read] = await reads().listByOrder("RT-7B");
    expect(read.anonymizedAt).toBeInstanceOf(Date);
    expect(read.customerEmail).toBe(`erased-${seeded.rma}@anonymized.invalid`);
    expect(await evidence().find(seeded.fileId)).toBeNull();
  });

  it("leaves another request's photos and audit rows alone", async () => {
    const erased = await seed("RT-8", "resolved", OLD);
    const kept = await seed("RT-9", "resolved", OLD);
    await retention().anonymize(erased.id);
    expect(await count(`select count(*) as n from "evidence_files" where "return_request_id" = ?`, [kept.id])).toBe(1);
    expect(await count(`select count(*) as n from "evidence_audit_events" where "evidence_file_id" = ?`, [kept.fileId])).toBe(1);
    expect((await retention().findByRma(kept.rma))?.anonymizedAt).toBeNull();
  });

  it("blanks the linked supplier claim texts and its event notes", async () => {
    const seeded = await seed("RT-10", "resolved", OLD);
    const [{ id: supplierId }] = await db.query<{ id: number }>(
      `insert into "suppliers" ("name", "email", "created_at", "updated_at") values ('Dostawca', 's@example.com', now(), now()) returning "id"`,
    );
    const [{ id: claimId }] = await db.query<{ id: number }>(
      `insert into "supplier_claims" ("ref", "return_request_id", "supplier_id", "subject", "body", "answer_note", "created_by_agent_id", "created_at", "updated_at")
       values ('SC-RT-10', ?, ?, 'Claim for the kettle', 'The customer says: crushed', 'vendor says no', ?, now(), now()) returning "id"`,
      [seeded.id, supplierId, agentId],
    );
    await db.query(`insert into "supplier_claim_events" ("supplier_claim_id", "type", "to_status", "note", "created_at") values (?, 'created', 'draft', 'agent note', now())`, [claimId]);
    await retention().anonymize(seeded.id);
    const [claim] = await db.query<{ subject: string; body: string; answer_note: string | null }>(`select "subject", "body", "answer_note" from "supplier_claims" where "id" = ?`, [claimId]);
    expect(claim).toEqual({ subject: "", body: "", answer_note: null });
    expect(await count(`select count(*) as n from "supplier_claim_events" where "supplier_claim_id" = ? and "note" is not null`, [claimId])).toBe(0);
  });

  it("does nothing the second time", async () => {
    const seeded = await seed("RT-11", "resolved", OLD);
    await retention().anonymize(seeded.id);
    expect(await retention().anonymize(seeded.id)).toEqual({ files: 0, auditRows: 0 });
  });

  it("rolls everything back when a statement fails", async () => {
    const seeded = await seed("RT-12", "resolved", OLD);
    await db.query(`alter table "supplier_claims" rename to "supplier_claims_off"`);
    try {
      await expect(retention().anonymize(seeded.id)).rejects.toThrow();
    } finally {
      await db.query(`alter table "supplier_claims_off" rename to "supplier_claims"`);
    }
    expect(await count(`select count(*) as n from "evidence_files" where "return_request_id" = ?`, [seeded.id])).toBe(1);
    expect((await retention().findByRma(seeded.rma))?.anonymizedAt).toBeNull();
  });
});

describe("purgeOrphans", () => {
  it("deletes old staged files and their audit rows, and nothing that is fresh or attached", async () => {
    const orphan = await evidence().stage(file("RT-13"), LIMITS, LONG_AGO);
    if (orphan.result !== "stored") throw new Error("stage failed");
    const fresh = await evidence().stage(file("RT-14"), LIMITS, LONG_AGO);
    if (fresh.result !== "stored") throw new Error("stage failed");
    await db.query(`update "evidence_audit_events" set "created_at" = ? where "evidence_file_id" = ?`, [OLD, orphan.file.id]);
    await db.query(`update "evidence_files" set "created_at" = ? where "id" = ?`, [OLD, orphan.file.id]);
    const attached = await seed("RT-15", "submitted", OLD);
    await db.query(`update "evidence_audit_events" set "created_at" = ? where "evidence_file_id" = ?`, [OLD, attached.fileId]);

    const purged = await retention().purgeOrphans(CUTOFF);
    expect(purged.files).toBeGreaterThanOrEqual(1);
    expect(purged.auditRows).toBeGreaterThanOrEqual(1);
    expect(await count(`select count(*) as n from "evidence_files" where "id" = ?`, [orphan.file.id])).toBe(0);
    expect(await count(`select count(*) as n from "evidence_files" where "id" in (?, ?)`, [fresh.file.id, attached.fileId])).toBe(2);
    expect(await count(`select count(*) as n from "evidence_audit_events" where "evidence_file_id" = ?`, [orphan.file.id])).toBe(0);
    expect(await count(`select count(*) as n from "evidence_audit_events" where "evidence_file_id" = ?`, [fresh.file.id])).toBe(1);
    expect(await count(`select count(*) as n from "evidence_audit_events" where "evidence_file_id" = ?`, [attached.fileId])).toBe(1);
  });
});

describe("the migration", () => {
  it("refuses to roll back while a request is anonymized, then drops the column when none is", async () => {
    const seeded = await seed("RT-16", "resolved", OLD);
    await retention().anonymize(seeded.id);
    await expect(db.migrateDown(MIGRATIONS.evidenceAudit)).rejects.toThrow(/anonymized requests exist/);
    await db.query(`update "return_requests" set "anonymized_at" = null`);
    await db.migrateDown(MIGRATIONS.evidenceAudit);
    expect(await count(`select count(*) as n from information_schema.columns where table_schema = current_schema() and table_name = 'return_requests' and column_name = 'anonymized_at'`)).toBe(0);
    await db.migrateUp();
  });
});
