import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { money, type NewEvidenceFile, type NewReturnRequest } from "@easyrms/core";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmReturnRepository } from "../returns/return.repository";
import { MikroOrmEvidenceRepository } from "./evidence.repository";

let db: TestDatabase;
let agentA: number;
let agentB: number;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
  [{ id: agentA }] = await db.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('a@example.com', 'Ula Agentka', 'active', now(), now()) returning "id"`,
  );
  [{ id: agentB }] = await db.query<{ id: number }>(
    `insert into "agents" ("email", "display_name", "status", "created_at", "updated_at") values ('b@example.com', 'Olek Agent', 'active', now(), now()) returning "id"`,
  );
});

afterAll(async () => {
  await db?.close();
});

const repository = (): MikroOrmEvidenceRepository => new MikroOrmEvidenceRepository({ em: db.fork() });
const LIMITS = { maxFilesPerRequest: 3, maxBytesPerOrder: 1000 };
const LONG_AGO = new Date("2000-01-01T00:00:00Z");

function file(order: string, size = 100): NewEvidenceFile {
  const data = new Uint8Array(size).fill(7);
  data[0] = 0xff;
  return { orderNumber: order, contentType: "image/jpeg", data, sha256: createHash("sha256").update(data).digest("hex"), label: "photo.jpg" };
}

async function stageOne(order: string, size = 100): Promise<string> {
  const outcome = await repository().stage(file(order, size), LIMITS, LONG_AGO);
  if (outcome.result !== "stored") throw new Error("stage failed");
  return outcome.file.id;
}

async function createRequest(order: string): Promise<number> {
  const input: NewReturnRequest = {
    orderNumber: order,
    customerEmail: "c@example.com",
    kind: "transport",
    items: [{ lineRef: "L1", sku: "S", name: "Kettle", quantity: 1, unitPrice: money(1000), reasonCode: "damaged_in_transit" }],
    resolution: "replacement",
    resolutionAmount: null,
    returnMethod: null,
    idempotencyKey: randomUUID(),
    defectDescription: "The box was crushed and the kettle is cracked.",
    defectDiscoveredOn: "2026-11-04",
  };
  return (await new MikroOrmReturnRepository({ em: db.fork(), logger: { error: () => undefined } }).createWithItems(input)).id;
}

interface AuditRow {
  evidence_file_id: string;
  order_number: string;
  return_request_id: number | null;
  action: string;
  actor: string;
  agent_id: number | null;
}
const auditOf = (fileId: string) =>
  db.query<AuditRow>(
    `select "evidence_file_id", "order_number", "return_request_id", "action", "actor", "agent_id" from "evidence_audit_events" where "evidence_file_id" = ? order by "id"`,
    [fileId],
  );
const auditCount = async (order: string) =>
  Number((await db.query<{ n: string }>(`select count(*) as n from "evidence_audit_events" where "order_number" = ?`, [order]))[0]?.n);

describe("an add is audited in the same transaction as the upload", () => {
  it("writes one guest 'added' row with the order and the file id, not yet tied to a request", async () => {
    const id = await stageOne("AU-1");
    expect(await auditOf(id)).toEqual([{ evidence_file_id: id, order_number: "AU-1", return_request_id: null, action: "added", actor: "guest", agent_id: null }]);
  });

  it("writes nothing for an upload the limits refused", async () => {
    for (let i = 0; i < 3; i += 1) await stageOne("AU-2");
    expect((await repository().stage(file("AU-2"), LIMITS, LONG_AGO)).result).toBe("too_many_files");
    expect((await repository().stage(file("AU-2", 990), { maxFilesPerRequest: 9, maxBytesPerOrder: 1000 }, LONG_AGO)).result).toBe("quota_exceeded");
    expect(await auditCount("AU-2")).toBe(3);
  });

  it("fails closed: when the audit row cannot be written the upload is rolled back too", async () => {
    await db.query(`alter table "evidence_audit_events" rename to "evidence_audit_events_off"`);
    try {
      await expect(repository().stage(file("AU-3"), LIMITS, LONG_AGO)).rejects.toThrow();
    } finally {
      await db.query(`alter table "evidence_audit_events_off" rename to "evidence_audit_events"`);
    }
    expect(Number((await db.query<{ n: string }>(`select count(*) as n from "evidence_files" where "order_number" = 'AU-3'`))[0]?.n)).toBe(0);
    expect(await auditCount("AU-3")).toBe(0);
  });
});

describe("a take-back is audited", () => {
  it("writes a guest 'removed' row for a staged file, and the row outlives the file", async () => {
    const id = await stageOne("AU-4");
    expect(await repository().deleteStaged("AU-4", id)).toBe(true);
    expect((await auditOf(id)).map((row) => row.action)).toEqual(["added", "removed"]);
    expect(await repository().find(id)).toBeNull();
  });

  it("writes nothing when nothing was removed (another order, unknown id, attached file)", async () => {
    const mine = await stageOne("AU-5");
    expect(await repository().deleteStaged("AU-6", mine)).toBe(false);
    expect(await repository().deleteStaged("AU-5", randomUUID())).toBe(false);
    const requestId = await createRequest("AU-5");
    await repository().attach("AU-5", [mine], requestId);
    expect(await repository().deleteStaged("AU-5", mine)).toBe(false);
    expect((await auditOf(mine)).map((row) => row.action)).toEqual(["added"]);
  });

  it("fails closed: when the audit row cannot be written the file is not removed", async () => {
    const id = await stageOne("AU-7");
    await db.query(`alter table "evidence_audit_events" rename to "evidence_audit_events_off"`);
    try {
      await expect(repository().deleteStaged("AU-7", id)).rejects.toThrow();
    } finally {
      await db.query(`alter table "evidence_audit_events_off" rename to "evidence_audit_events"`);
    }
    expect(await repository().find(id)).not.toBeNull();
  });
});

describe("attach ties the trail to the request", () => {
  it("sets the request on the rows of the attached files only", async () => {
    const order = "AU-8";
    const [a, b, left] = [await stageOne(order), await stageOne(order), await stageOne(order)];
    const requestId = await createRequest(order);
    await repository().attach(order, [a, b], requestId);
    expect((await auditOf(a))[0]?.return_request_id).toBe(requestId);
    expect((await auditOf(b))[0]?.return_request_id).toBe(requestId);
    expect((await auditOf(left))[0]?.return_request_id).toBeNull();
  });

  it("leaves the rows alone when the attach is refused", async () => {
    const order = "AU-9";
    const good = await stageOne(order);
    const requestId = await createRequest(order);
    expect((await repository().attach(order, [good, randomUUID()], requestId)).result).toBe("invalid");
    expect((await auditOf(good))[0]?.return_request_id).toBeNull();
  });
});

describe("recordDownload", () => {
  const download = (fileId: string, order: string, agent: number, requestId: number | null) =>
    repository().recordDownload({ evidenceFileId: fileId, orderNumber: order, returnRequestId: requestId, agentId: agent });
  const downloads = async (fileId: string) => (await auditOf(fileId)).filter((row) => row.action === "downloaded");

  it("records an agent download with the agent and the request", async () => {
    const order = "DL-1";
    const id = await stageOne(order);
    const requestId = await createRequest(order);
    await repository().attach(order, [id], requestId);
    await download(id, order, agentA, requestId);
    expect(await downloads(id)).toEqual([{ evidence_file_id: id, order_number: order, return_request_id: requestId, action: "downloaded", actor: "agent", agent_id: agentA }]);
  });

  it("records one row per agent and file within 10 minutes, so reloading a card does not flood the trail", async () => {
    const order = "DL-2";
    const id = await stageOne(order);
    const other = await stageOne(order);
    for (let i = 0; i < 5; i += 1) await download(id, order, agentA, null);
    expect(await downloads(id)).toHaveLength(1);
    await download(id, order, agentB, null);
    await download(other, order, agentA, null);
    expect(await downloads(id)).toHaveLength(2);
    expect(await downloads(other)).toHaveLength(1);
  });

  it("records again once the window has passed", async () => {
    const order = "DL-3";
    const id = await stageOne(order);
    await download(id, order, agentA, null);
    await db.query(`update "evidence_audit_events" set "created_at" = now() - interval '11 minutes' where "evidence_file_id" = ? and "action" = 'downloaded'`, [id]);
    await download(id, order, agentA, null);
    expect(await downloads(id)).toHaveLength(2);
  });

  it("holds under concurrent downloads of the same file by the same agent: at most a handful of rows, never one per call", async () => {
    const order = "DL-4";
    const id = await stageOne(order);
    await Promise.all(Array.from({ length: 10 }, () => download(id, order, agentA, null)));
    // The window check is not locked (a read must stay cheap), so a race may let a few through; the trail never grows per call.
    expect((await downloads(id)).length).toBeLessThan(10);
  });
});

describe("listAudit", () => {
  it("lists the trail of a request oldest first with the file label and the agent's name", async () => {
    const order = "LA-1";
    const id = await stageOne(order);
    const requestId = await createRequest(order);
    await repository().attach(order, [id], requestId);
    await repository().recordDownload({ evidenceFileId: id, orderNumber: order, returnRequestId: requestId, agentId: agentA });

    const trail = await repository().listAudit(requestId);
    expect(trail.map((entry) => [entry.action, entry.actor, entry.label, entry.agentName])).toEqual([
      ["added", "guest", "photo.jpg", null],
      ["downloaded", "agent", "photo.jpg", "Ula Agentka"],
    ]);
    expect(trail.every((entry) => entry.createdAt instanceof Date && entry.evidenceFileId === id)).toBe(true);
    expect(trail[0]?.createdAt.getTime()).toBeLessThanOrEqual(trail[1]?.createdAt.getTime() ?? 0);
  });

  it("is empty for a request without photos and for an unknown request", async () => {
    expect(await repository().listAudit(await createRequest("LA-2"))).toEqual([]);
    expect(await repository().listAudit(987654)).toEqual([]);
  });

  it("survives the erasure path: the rows stay after the files are deleted, with no label", async () => {
    const order = "LA-3";
    const id = await stageOne(order);
    const requestId = await createRequest(order);
    await repository().attach(order, [id], requestId);
    await repository().recordDownload({ evidenceFileId: id, orderNumber: order, returnRequestId: requestId, agentId: agentB });
    expect(await repository().deleteForRequest(requestId)).toBe(1);

    const trail = await repository().listAudit(requestId);
    expect(trail.map((entry) => [entry.action, entry.label])).toEqual([
      ["added", null],
      ["downloaded", null],
    ]);
  });

  it("does not mix requests: only the rows of the asked request come back", async () => {
    const order = "LA-4";
    const [x, y] = [await stageOne(order), await stageOne(order)];
    const [r1, r2] = [await createRequest(order), await createRequest(order)];
    await repository().attach(order, [x], r1);
    await repository().attach(order, [y], r2);
    expect((await repository().listAudit(r1)).map((e) => e.evidenceFileId)).toEqual([x]);
    expect((await repository().listAudit(r2)).map((e) => e.evidenceFileId)).toEqual([y]);
  });
});

describe("Migration20261111120000", () => {
  it("down refuses while an audit row exists and changes nothing", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      await new MikroOrmEvidenceRepository({ em: database.fork() }).stage(file("MG-1"), LIMITS, LONG_AGO);
      await expect(database.migrateDown(MIGRATIONS.evidenceFiles)).rejects.toThrow(/audit events exist/);
      expect(await database.query(`select 1 from "evidence_audit_events"`)).toHaveLength(1);
    } finally {
      await database.close();
    }
  });

  it("drops the table when it is empty", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      await database.migrateDown(MIGRATIONS.evidenceFiles);
      const tables = await database.query<{ table_name: string }>(`select "table_name" from information_schema.tables where table_schema = ?`, [database.schema]);
      expect(tables.map((t) => t.table_name)).not.toContain("evidence_audit_events");
    } finally {
      await database.close();
    }
  });

  it("has no foreign key on the file or the request, and a restrict key on the agent", async () => {
    const rows = await db.query<{ column_name: string; delete_rule: string }>(
      `select kcu.column_name, rc.delete_rule from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
       join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
       where tc.table_schema = ? and tc.table_name = 'evidence_audit_events' and tc.constraint_type = 'FOREIGN KEY'`,
      [db.schema],
    );
    expect(rows).toEqual([{ column_name: "agent_id", delete_rule: "RESTRICT" }]);
  });
});
