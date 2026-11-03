import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  COMPLAINT_ESCALATION_DAY,
  INBOX_PAGE_SIZE,
  complaintEscalated,
  normalizeInboxOptions,
  viewInbox,
  type ApiLogger,
  type RequestKind,
  type ReturnInboxQuery,
  type ReturnRequest,
  type StoredReturnStatus,
} from "@easyrms/core";

import { createTestDatabase, type TestDatabase } from "../../test-support/postgres";
import { MikroOrmReturnRepository } from "./return.repository";

/**
 * `listInbox` moves the search, the Warsaw-day range, the escalated-first order and the paging from `viewInbox` /
 * `complaintEscalated` (TypeScript) into SQL. These tests run both implementations on the same rows and require the
 * same answer, so a rule that drifts on either side fails here.
 */

const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-06T10:00:00Z");
/** Instants around the two Warsaw clock changes of 2026, where wall-clock arithmetic in SQL and TypeScript can differ. */
const NOWS = [
  NOW,
  new Date("2026-10-25T00:30:00Z"),
  new Date("2026-10-25T01:30:00Z"),
  new Date("2026-10-25T02:30:00Z"),
  new Date("2026-04-08T00:30:00Z"),
  new Date("2026-04-08T01:30:00Z"),
];
const MINUTE_OFFSETS = [-61, -60, -59, -1, 0, 1, 59, 60, 61];
const BIG_PAGE = 1000;

let db: TestDatabase;
let sequence = 0;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.migrateUp();
  await seed();
});

afterAll(async () => {
  await db?.close();
});

function makeLogger() {
  return { error: vi.fn<ApiLogger["error"]>() };
}

function repository(logger: ApiLogger = makeLogger()): MikroOrmReturnRepository {
  return new MikroOrmReturnRepository({ em: db.fork(), logger });
}

async function insert(row: { rma?: string; kind: RequestKind; status: string; createdAt: Date }): Promise<void> {
  sequence += 1;
  const rma = row.rma ?? `RMA-2026-${String(sequence).padStart(5, "0")}`;
  await db.query(
    `insert into "return_requests" ("rma", "kind", "order_number", "customer_email", "status", "created_at", "updated_at") values (?, ?, ?, ?, ?, ?, ?)`,
    [rma, row.kind, `ORD-${sequence}`, "customer@example.com", row.status, row.createdAt, row.createdAt],
  );
}

async function seed(): Promise<void> {
  const statuses: StoredReturnStatus[] = ["submitted", "approved", "rejected", "resolved"];
  // A spread of returns and complaints over several months, so filters and pages have something to cut.
  for (let i = 0; i < 40; i += 1) {
    await insert({ kind: i % 3 === 0 ? "complaint" : "return", status: statuses[i % statuses.length] as string, createdAt: new Date(Date.UTC(2026, 2, 1 + i * 4, 6 + (i % 9), i % 60)) });
  }
  // Unanswered complaints on both sides of the escalation instant, for every clock-change case.
  for (const now of NOWS) {
    for (const minutes of MINUTE_OFFSETS) {
      await insert({ kind: "complaint", status: "submitted", createdAt: new Date(now.getTime() - COMPLAINT_ESCALATION_DAY * DAY_MS + minutes * 60_000) });
    }
  }
  // Rows on both sides of a Warsaw midnight, across both clock changes.
  for (const iso of [
    "2026-03-28T22:59:59Z", "2026-03-28T23:00:00Z", "2026-03-29T21:59:59Z", "2026-03-29T22:00:00Z",
    "2026-10-24T21:59:59Z", "2026-10-24T22:00:00Z", "2026-10-25T22:59:59Z", "2026-10-25T23:00:00Z",
  ]) {
    await insert({ kind: "return", status: "submitted", createdAt: new Date(iso) });
  }
  // RMAs that differ only in what a LIKE pattern would treat as a wildcard, and a stored status nobody can read.
  for (const rma of ["RMA-X_Y", "RMA-XZY", "RMA-100%", "RMA-100A", "RMA-Q\\Z", "RMA-QZ"]) {
    await insert({ rma, kind: "return", status: "submitted", createdAt: new Date("2026-09-01T10:00:00Z") });
  }
  await insert({ rma: "RMA-BOGUS", kind: "return", status: "bogus", createdAt: new Date("2026-09-02T10:00:00Z") });
}

/** What the page did before: `list` (status and kind in SQL), escalated complaints first, then `viewInbox`. */
async function reference(query: Omit<ReturnInboxQuery, "pageSize" | "now" | "escalationDays">, now: Date) {
  const all = await repository().list({ ...(query.status ? { status: query.status } : {}), ...(query.kind ? { kind: query.kind } : {}) });
  const escalated = (row: ReturnRequest): boolean => row.kind === "complaint" && complaintEscalated(row.status, row.createdAt, now);
  const ordered = [...all.filter(escalated), ...all.filter((row) => !escalated(row))];
  const view = viewInbox(ordered, { search: query.search, from: query.from, to: query.to, page: query.page });
  return { rmas: view.rows.map((row) => row.rma), total: view.total, page: view.page, pageCount: view.pageCount };
}

async function actual(query: Omit<ReturnInboxQuery, "pageSize" | "now" | "escalationDays">, now: Date, pageSize = INBOX_PAGE_SIZE) {
  const result = await repository().listInbox({ ...query, pageSize, now, escalationDays: COMPLAINT_ESCALATION_DAY });
  return { rmas: result.rows.map((row) => row.rma), total: result.total, page: result.page, pageCount: result.pageCount };
}

describe("escalated-first order", () => {
  it.each(NOWS.map((now) => [now.toISOString(), now] as const))("first page equals the in-memory reorder (now = %s)", async (_label, now) => {
    expect(await actual({ page: 1 }, now)).toEqual(await reference({ page: 1 }, now));
  });

  it.each(NOWS.map((now) => [now.toISOString(), now] as const))("agrees on every row's escalation flag (now = %s)", async (_label, now) => {
    const all = await repository().list();
    const flagged = new Set(all.filter((row) => row.kind === "complaint" && complaintEscalated(row.status, row.createdAt, now)).map((row) => row.rma));
    const page = await actual({ page: 1 }, now, BIG_PAGE);
    const leading = page.rmas.slice(0, flagged.size);
    expect(new Set(leading)).toEqual(flagged);
    // Everything after the escalated block is newest first, i.e. strictly the repository's own default order.
    const rest = all.filter((row) => !flagged.has(row.rma)).map((row) => row.rma);
    expect(page.rmas.slice(flagged.size)).toEqual(rest);
  });
});

describe("filters and paging equal the in-memory view", () => {
  const statuses: (StoredReturnStatus | undefined)[] = [undefined, "submitted", "approved", "unknown"];
  const kinds: (RequestKind | undefined)[] = [undefined, "complaint", "return"];
  const searches = [undefined, "0001", "rma-2026-0", "x", "100", "zzz"];
  const ranges: { from?: string; to?: string }[] = [
    {},
    { from: "2026-03-29", to: "2026-03-29" },
    { from: "2026-10-25", to: "2026-10-25" },
    { from: "2026-04-01" },
    { to: "2026-04-01" },
    { from: "2026-12-01", to: "2026-01-01" },
  ];
  const pages = [1, 2, 99];

  it("returns the same rows, total, page and pageCount for every combination", async () => {
    let compared = 0;
    for (const status of statuses) {
      for (const kind of kinds) {
        for (const search of searches) {
          for (const range of ranges) {
            for (const page of pages) {
              const query = { ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(search ? { search } : {}), ...range, page };
              expect(await actual(query, NOW), JSON.stringify(query)).toEqual(await reference(query, NOW));
              compared += 1;
            }
          }
        }
      }
    }
    expect(compared).toBe(statuses.length * kinds.length * searches.length * ranges.length * pages.length);
  }, 120_000);

  it("clamps a page past the end and an empty result to page 1 of 1", async () => {
    const last = await actual({ page: 99 }, NOW);
    expect(last.page).toBe(last.pageCount);
    expect(last.rmas.length).toBeGreaterThan(0);
    expect(await actual({ search: "no-such-rma", page: 4 }, NOW)).toEqual({ rmas: [], total: 0, page: 1, pageCount: 1 });
  });

  it("uses the same normalized values the service sends", async () => {
    const normalized = normalizeInboxOptions({ search: "  RMA-X_Y ", from: "bad", page: 0 });
    expect(await actual(normalized, NOW)).toMatchObject({ rmas: ["RMA-X_Y"], total: 1 });
  });
});

describe("search", () => {
  it("matches % and _ and a backslash literally, never as wildcards", async () => {
    expect((await actual({ search: "_", page: 1 }, NOW)).rmas).toEqual(["RMA-X_Y"]);
    expect((await actual({ search: "%", page: 1 }, NOW)).rmas).toEqual(["RMA-100%"]);
    expect((await actual({ search: "\\", page: 1 }, NOW)).rmas).toEqual(["RMA-Q\\Z"]);
  });

  it("ignores case", async () => {
    expect((await actual({ search: "rma-xzy", page: 1 }, NOW)).rmas).toEqual(["RMA-XZY"]);
  });
});

describe("unreadable stored status", () => {
  it("is listed by the unknown filter and logged once for the page it is on", async () => {
    const logger = makeLogger();
    const result = await new MikroOrmReturnRepository({ em: db.fork(), logger }).listInbox({
      status: "unknown",
      page: 1,
      pageSize: INBOX_PAGE_SIZE,
      now: NOW,
      escalationDays: COMPLAINT_ESCALATION_DAY,
    });
    expect(result.rows.map((row) => row.rma)).toEqual(["RMA-BOGUS"]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("is not logged when it is not on the returned page", async () => {
    const logger = makeLogger();
    await new MikroOrmReturnRepository({ em: db.fork(), logger }).listInbox({
      status: "approved",
      page: 1,
      pageSize: INBOX_PAGE_SIZE,
      now: NOW,
      escalationDays: COMPLAINT_ESCALATION_DAY,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
