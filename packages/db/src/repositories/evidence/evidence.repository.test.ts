import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { money, type NewEvidenceFile, type NewReturnRequest } from "@easyrms/core";

import { createTestDatabase, MIGRATIONS, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmReturnRepository } from "../returns/return.repository";
import { MikroOrmEvidenceRepository } from "./evidence.repository";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
});

afterAll(async () => {
  await db?.close();
});

const repository = (): MikroOrmEvidenceRepository => new MikroOrmEvidenceRepository({ em: db.fork() });
const LIMITS = { maxFilesPerRequest: 3, maxBytesPerOrder: 1000 };
const LONG_AGO = new Date("2000-01-01T00:00:00Z");

function file(order: string, size = 100, overrides: Partial<NewEvidenceFile> = {}): NewEvidenceFile {
  const data = new Uint8Array(size).fill(7);
  data[0] = 0xff;
  return { orderNumber: order, contentType: "image/jpeg", data, sha256: createHash("sha256").update(data).digest("hex"), label: "photo.jpg", ...overrides };
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

const count = async (order: string) =>
  Number((await db.query<{ n: string }>(`select count(*) as n from "evidence_files" where "order_number" = ?`, [order]))[0]?.n);

describe("stage and find", () => {
  it("stores the bytes under a random UUID and reads them back unchanged", async () => {
    const input = file("S-1", 50);
    const outcome = await repository().stage(input, LIMITS, LONG_AGO);
    expect(outcome.result).toBe("stored");
    if (outcome.result !== "stored") return;
    expect(outcome.file).toMatchObject({ orderNumber: "S-1", returnRequestId: null, contentType: "image/jpeg", byteSize: 50, sha256: input.sha256, label: "photo.jpg" });
    expect(outcome.file.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const found = await repository().find(outcome.file.id);
    expect(found?.file.id).toBe(outcome.file.id);
    expect(Array.from(found?.data ?? [])).toEqual(Array.from(input.data));
  });

  it("answers null for an unknown id and for text that is not a UUID", async () => {
    expect(await repository().find(randomUUID())).toBeNull();
    expect(await repository().find("1; drop table evidence_files")).toBeNull();
    expect(await repository().find("")).toBeNull();
  });
});

describe("limits", () => {
  it("refuses the file past the per-request count and keeps the first ones", async () => {
    for (let i = 0; i < 3; i += 1) expect((await repository().stage(file("Q-1"), LIMITS, LONG_AGO)).result).toBe("stored");
    expect((await repository().stage(file("Q-1"), LIMITS, LONG_AGO)).result).toBe("too_many_files");
    expect(await count("Q-1")).toBe(3);
  });

  it("refuses the file that would push the order past its byte quota", async () => {
    expect((await repository().stage(file("Q-2", 600), LIMITS, LONG_AGO)).result).toBe("stored");
    expect((await repository().stage(file("Q-2", 401), LIMITS, LONG_AGO)).result).toBe("quota_exceeded");
    expect((await repository().stage(file("Q-2", 400), LIMITS, LONG_AGO)).result).toBe("stored");
    expect(await count("Q-2")).toBe(2);
  });

  it("two tabs of one order cannot both pass: concurrent uploads stay within the count and the bytes", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => repository().stage(file("Q-3", 300), LIMITS, LONG_AGO)));
    const stored = results.filter((outcome) => outcome.result === "stored").length;
    expect(stored).toBe(3);
    expect(await count("Q-3")).toBe(3);
    const bytes = Number((await db.query<{ s: string }>(`select sum("byte_size") as s from "evidence_files" where "order_number" = 'Q-3'`))[0]?.s);
    expect(bytes).toBeLessThanOrEqual(LIMITS.maxBytesPerOrder);
  });

  it("counts per order: another order has its own budget", async () => {
    await repository().stage(file("Q-4", 900), LIMITS, LONG_AGO);
    expect((await repository().stage(file("Q-5", 900), LIMITS, LONG_AGO)).result).toBe("stored");
  });

  it("does not count attached files toward the per-request count, only toward the order bytes", async () => {
    const order = "Q-6";
    const staged = await repository().stage(file(order, 100), LIMITS, LONG_AGO);
    const requestId = await createRequest(order);
    if (staged.result === "stored") await repository().attach(order, [staged.file.id], requestId);
    for (let i = 0; i < 3; i += 1) expect((await repository().stage(file(order, 100), LIMITS, LONG_AGO)).result).toBe("stored");
    expect((await repository().stage(file(order, 100), LIMITS, LONG_AGO)).result).toBe("too_many_files");
  });
});

describe("orphans", () => {
  it("deletes staged files older than the cutoff on the next stage, of that order only", async () => {
    const old = await repository().stage(file("O-1"), LIMITS, LONG_AGO);
    const other = await repository().stage(file("O-2"), LIMITS, LONG_AGO);
    await db.query(`update "evidence_files" set "created_at" = now() - interval '3 hours' where "id" = ?`, [old.result === "stored" ? old.file.id : ""]);
    await db.query(`update "evidence_files" set "created_at" = now() - interval '3 hours' where "id" = ?`, [other.result === "stored" ? other.file.id : ""]);

    await repository().stage(file("O-1"), LIMITS, new Date(Date.now() - 2 * 3600_000));
    expect(await count("O-1")).toBe(1);
    expect(await count("O-2")).toBe(1);
    if (old.result === "stored") expect(await repository().find(old.file.id)).toBeNull();
  });

  it("never deletes an attached file, however old", async () => {
    const order = "O-3";
    const staged = await repository().stage(file(order), LIMITS, LONG_AGO);
    const requestId = await createRequest(order);
    if (staged.result !== "stored") throw new Error("stage failed");
    await repository().attach(order, [staged.file.id], requestId);
    await db.query(`update "evidence_files" set "created_at" = now() - interval '9 hours' where "id" = ?`, [staged.file.id]);
    await repository().stage(file(order), LIMITS, new Date());
    expect(await repository().find(staged.file.id)).not.toBeNull();
  });
});

describe("attach", () => {
  async function stagedIds(order: string, n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const outcome = await repository().stage(file(order), LIMITS, LONG_AGO);
      if (outcome.result === "stored") ids.push(outcome.file.id);
    }
    return ids;
  }

  it("attaches staged files of the order once, and they keep their bytes", async () => {
    const order = "A-1";
    const ids = await stagedIds(order, 2);
    const requestId = await createRequest(order);
    const outcome = await repository().attach(order, ids, requestId);
    expect(outcome.result).toBe("attached");
    expect(outcome.result === "attached" && outcome.files.every((f) => f.returnRequestId === requestId)).toBe(true);
    expect((await repository().find(ids[0] ?? ""))?.file.returnRequestId).toBe(requestId);
  });

  it("refuses an id already attached to a request, changing nothing", async () => {
    const order = "A-2";
    const [first, second] = await stagedIds(order, 2);
    const requestId = await createRequest(order);
    await repository().attach(order, [first ?? ""], requestId);
    const other = await createRequest(order);
    expect((await repository().attach(order, [second ?? "", first ?? ""], other)).result).toBe("invalid");
    expect((await repository().find(second ?? ""))?.file.returnRequestId).toBeNull();
    expect((await repository().find(first ?? ""))?.file.returnRequestId).toBe(requestId);
  });

  it("gives the same answer for another order's id, an unknown id and a malformed one", async () => {
    const [foreign] = await stagedIds("A-3", 1);
    const requestId = await createRequest("A-4");
    for (const id of [foreign ?? "", randomUUID(), "not-a-uuid"]) {
      expect((await repository().attach("A-4", [id], requestId)).result).toBe("invalid");
    }
    expect((await repository().find(foreign ?? ""))?.file.returnRequestId).toBeNull();
  });

  it("treats a repeated id as one and attaches no files for an empty list", async () => {
    const order = "A-5";
    const [id] = await stagedIds(order, 1);
    const requestId = await createRequest(order);
    expect((await repository().attach(order, [id ?? "", id ?? ""], requestId)).result).toBe("attached");
    expect(await repository().attach(order, [], requestId)).toEqual({ result: "attached", files: [] });
  });

  it("is atomic under two attaches of the same file: exactly one wins", async () => {
    const order = "A-6";
    const [id] = await stagedIds(order, 1);
    const [a, b] = [await createRequest(order), await createRequest(order)];
    const results = await Promise.all([repository().attach(order, [id ?? ""], a), repository().attach(order, [id ?? ""], b)]);
    expect(results.map((r) => r.result).sort()).toEqual(["attached", "invalid"]);
  });
});

describe("deleteForRequest", () => {
  it("deletes the files of one request and nothing else", async () => {
    const order = "D-1";
    const staged = await repository().stage(file(order), LIMITS, LONG_AGO);
    const leftover = await repository().stage(file(order), LIMITS, LONG_AGO);
    const requestId = await createRequest(order);
    if (staged.result !== "stored" || leftover.result !== "stored") throw new Error("stage failed");
    await repository().attach(order, [staged.file.id], requestId);

    expect(await repository().deleteForRequest(requestId)).toBe(1);
    expect(await repository().find(staged.file.id)).toBeNull();
    expect(await repository().find(leftover.file.id)).not.toBeNull();
    expect(await repository().deleteForRequest(requestId)).toBe(0);
  });

  it("keeps the restrict rule: a request with files cannot be deleted from under them", async () => {
    const order = "D-2";
    const staged = await repository().stage(file(order), LIMITS, LONG_AGO);
    const requestId = await createRequest(order);
    if (staged.result === "stored") await repository().attach(order, [staged.file.id], requestId);
    await expect(db.query(`delete from "return_requests" where "id" = ?`, [requestId])).rejects.toThrow();
  });
});

describe("Migration20261111100000", () => {
  it("creates the table, and down refuses while a file exists", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      const em = database.fork();
      await new MikroOrmEvidenceRepository({ em }).stage(file("M-1"), LIMITS, LONG_AGO);
      await expect(database.migrateDown(MIGRATIONS.courierNote)).rejects.toThrow(/Refusing to roll back/);
      expect(await database.query(`select 1 from "evidence_files"`)).toHaveLength(1);
    } finally {
      await database.close();
    }
  });

  it("drops the table when it is empty", async () => {
    const database = await createTestDatabase();
    try {
      await database.migrateUp();
      await database.migrateDown(MIGRATIONS.courierNote);
      const tables = await database.query<{ table_name: string }>(`select "table_name" from information_schema.tables where table_schema = ?`, [database.schema]);
      expect(tables.map((t) => t.table_name)).not.toContain("evidence_files");
    } finally {
      await database.close();
    }
  });
});
