import { describe, expect, it, vi } from "vitest";

import { createFakeOrderLookup } from "../../adapters/orders/fake-order-lookup";
import { money } from "../../domain/money";
import { BRIEF_RULES } from "../../rules";
import { RateLimiter } from "../../security/rate-limiter";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import type { ApiLogger } from "../../http/types";
import { returnListQuerySchema } from "../../validators/returns/return-list-query.schema";
import { returnStatusUpdateSchema } from "../../validators/returns/return-status-update.schema";
import type { AgentPermission } from "../agents/types";
import { isReturnStatus, ReturnService, toReturnStatus } from "./return.service";
import type { MailMessage, MailPort } from "../mail/mail.port";
import { COMPLAINT_ESCALATION_DAY } from "./complaint-sla";
import { INBOX_PAGE_SIZE } from "./inbox-view";
import type { RecommendationConfig } from "./recommendation-config";
import { returnStateMachine } from "./transitions";
import {
  RETURN_STATUSES,
  type ReturnDetail,
  type ReturnEvent,
  type ReturnInboxQuery,
  type ReturnRepository,
  type ReturnRequest,
  type RuleComparisonRecord,
} from "./types";

// Thursday 5 Nov 2026 10:00 Warsaw is UTC+1 all week, so due dates are easy to read.
const CREATED = new Date("2026-11-05T10:00:00Z");
const AGENT = { id: 7, permissions: [] as AgentPermission[] };
const MANAGER = { id: 8, permissions: ["MANAGE_RULES"] as AgentPermission[] };
const LONG_NOTE = "Item was used and returned after the period ended";
const SECRET_NOTE = "ZZ-secret-customer-note-ZZ ZZ-secret-customer-note-ZZ";

function makeRequest(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 1,
    rma: "RMA-2026-00001",
    kind: "return",
    orderNumber: "ORD-1",
    customerEmail: "customer@example.com",
    reason: "Too small",
    status: "submitted",
    hasDecisionNote: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

interface Fake extends ReturnRepository {
  rows: ReturnRequest[];
  notes: Map<number, string | null>;
  events: ReturnEvent[];
  comparisons: Array<RuleComparisonRecord & { id: number }>;
  /** Lets a test change the stored status after the service read it, as a second agent would. */
  beforeTransition?: () => void;
}

/** The portal methods are exercised by later flow tests; this fake only covers the agent workflow. */
const unsupported = (): never => {
  throw new Error("not implemented in this fake");
};

/** In-memory stand-in for the `db` repository port, with the same compare-and-set and note semantics. */
function makeRepository(initial: ReturnRequest[] = []): Fake {
  const fake: Fake = {
    rows: [...initial],
    notes: new Map(),
    events: [],
    comparisons: [],
    list: async (filter) => fake.rows.filter((row) => !filter?.status || row.status === filter.status),
    listInbox: unsupported,
    findStatus: async (id) => fake.rows.find((row) => row.id === id)?.status ?? null,
    findRequest: async (id) => fake.rows.find((row) => row.id === id) ?? null,
    findDetail: async (id): Promise<ReturnDetail | null> => {
      const request = fake.rows.find((row) => row.id === id);
      return request ? { request, decisionNote: fake.notes.get(id) ?? null, items: [], events: [...fake.events] } : null;
    },
    createWithItems: unsupported,
    listByOrder: unsupported,
    findByRma: unsupported,
    findByIdempotencyKey: unsupported,
    claimedQuantities: unsupported,
    withOrderLock: unsupported,
    attachEvidence: unsupported,
    transition: async (id, from, to, note, agentId, _defectConfirmed, comparison) => {
      fake.beforeTransition?.();
      if (comparison) fake.comparisons.push({ id, ...comparison });
      const row = fake.rows.find((candidate) => candidate.id === id);
      if (!row) return { result: "not_found" };
      if (row.status !== from) return { result: "conflict", currentStatus: row.status };
      row.status = to;
      if (to === "approved" || to === "rejected") {
        fake.notes.set(id, note);
        row.hasDecisionNote = note !== null;
      }
      fake.events.push({
        id: fake.events.length + 1,
        type: "status_changed",
        fromStatus: from,
        toStatus: to,
        note,
        actor: "agent",
        agentId,
        createdAt: CREATED,
      });
      return { result: "moved", request: row };
    },
  };
  return fake;
}

function makeMailPort(): MailPort & { sent: MailMessage[] } {
  const port = { sent: [] as MailMessage[], send: (message: MailMessage): void => void port.sent.push(message) };
  return port;
}

function makeService(
  repository: ReturnRepository,
  now = new Date("2026-11-06T10:00:00Z"),
  mailPort: MailPort = makeMailPort(),
  logger: ApiLogger = { error: vi.fn() },
  recommendationConfig?: RecommendationConfig,
): ReturnService {
  return new ReturnService({
    returnRepository: repository,
    clock: () => now,
    mailPort,
    logger,
    orderLookup: createFakeOrderLookup({ clock: () => now }),
    rateLimiter: new RateLimiter({ clock: () => now }),
    eligibilityConfig: { windowDays: 30 },
    quoteConfig: { shippingFee: money(1000) },
    approvalConfig: { refundApprovalLimit: money(200000) },
    recommendationConfig,
  });
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
}

describe("isReturnStatus / toReturnStatus", () => {
  it("accepts each of the nine statuses", () => {
    expect(RETURN_STATUSES).toHaveLength(9);
    for (const status of RETURN_STATUSES) {
      expect(isReturnStatus(status)).toBe(true);
      expect(toReturnStatus(status)).toBe(status);
    }
  });

  it("maps legacy values, garbage and non-strings to unknown", () => {
    for (const value of ["requested", "refunded", "shipped", "", null, undefined, 1]) {
      expect(isReturnStatus(value)).toBe(false);
      expect(toReturnStatus(value)).toBe("unknown");
    }
  });
});

describe("return state machine", () => {
  const allowed: [string, string][] = [
    ["submitted", "approved"],
    ["submitted", "rejected"],
    ["approved", "in_transit"],
    ["in_transit", "received"],
    ["received", "resolved"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(returnStateMachine.can(from, to)).toBe(true);
  });

  it("allows nothing else: every other pair of the nine statuses is forbidden", () => {
    for (const from of RETURN_STATUSES) {
      for (const to of RETURN_STATUSES) {
        const expected = allowed.some(([a, b]) => a === from && b === to);
        expect(returnStateMachine.can(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("has no moves from the later-spec statuses, the terminal ones or an unknown status", () => {
    for (const status of ["awaiting_customer", "in_service", "cancelled", "resolved", "rejected", "unknown"]) {
      expect(returnStateMachine.allowed(status)).toEqual([]);
    }
  });
});

describe("ReturnService.list", () => {
  it("computes dueAt, overdue and allowedTransitions from the injected clock", async () => {
    const service = makeService(
      makeRepository([
        makeRequest({ id: 1 }),
        makeRequest({ id: 2, status: "approved" }),
        makeRequest({ id: 3, status: "unknown" }),
      ]),
      new Date("2026-11-09T10:00:00.001Z"),
    );

    const [submitted, approved, unknown] = await service.list();

    expect(submitted.dueAt.toISOString()).toBe("2026-11-09T10:00:00.000Z");
    expect(submitted.overdue).toBe(true);
    expect(submitted.allowedTransitions).toEqual(["approved", "rejected"]);
    expect(approved.overdue).toBe(false);
    expect(approved.allowedTransitions).toEqual(["in_transit"]);
    expect(unknown.status).toBe("unknown");
    expect(unknown.allowedTransitions).toEqual([]);
    expect(unknown.overdue).toBe(false);
  });

  it("is not overdue at exactly the due instant", async () => {
    const service = makeService(makeRepository([makeRequest()]), new Date("2026-11-09T10:00:00Z"));

    expect((await service.list())[0].overdue).toBe(false);
  });

  it("passes the status filter to the repository", async () => {
    const service = makeService(makeRepository([makeRequest({ id: 1 }), makeRequest({ id: 2, status: "approved" })]));

    expect((await service.list({ status: "approved" })).map((item) => item.id)).toEqual([2]);
    expect(await service.list({ status: "resolved" })).toEqual([]);
  });
});

describe("ReturnService.listInbox", () => {
  it("passes the normalized query, the clock and the escalation constants, and builds list items for the page only", async () => {
    const repository = makeRepository();
    const seen: ReturnInboxQuery[] = [];
    repository.listInbox = async (query) => {
      seen.push(query);
      return { rows: [makeRequest({ id: 7, status: "submitted" })], total: 31, page: 2, pageCount: 4 };
    };
    const now = new Date("2026-11-06T10:00:00Z");

    const view = await makeService(repository, now).listInbox({ status: "submitted", kind: "complaint", search: "  RMA-2026-0001 ", from: "2026-11-01", to: "nonsense", page: 2.9 });

    expect(seen).toEqual([
      { status: "submitted", kind: "complaint", search: "rma-2026-0001", from: "2026-11-01", page: 2, pageSize: INBOX_PAGE_SIZE, now, escalationDays: COMPLAINT_ESCALATION_DAY },
    ]);
    expect(view).toMatchObject({ total: 31, page: 2, pageCount: 4 });
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ id: 7, dueAt: expect.any(Date), overdue: expect.any(Boolean), allowedTransitions: expect.any(Array) });
  });

  it("sends no optional filter that was not given", async () => {
    const repository = makeRepository();
    let seen: ReturnInboxQuery | undefined;
    repository.listInbox = async (query) => {
      seen = query;
      return { rows: [], total: 0, page: 1, pageCount: 1 };
    };
    await makeService(repository).listInbox({ page: Number.NaN, search: "   " });
    expect(seen).toMatchObject({ page: 1 });
    expect(seen).not.toHaveProperty("search");
    expect(seen).not.toHaveProperty("status");
    expect(seen).not.toHaveProperty("kind");
  });
});

describe("ReturnService.getDetail", () => {
  it("returns the note, the events and the derived values", async () => {
    const repository = makeRepository([makeRequest()]);
    const service = makeService(repository);
    await service.transition(1, "approved", ` ${LONG_NOTE} `, AGENT);

    const detail = await service.getDetail(1);

    expect(detail.decisionNote).toBe(LONG_NOTE);
    expect(detail.events).toHaveLength(1);
    expect(detail.request.allowedTransitions).toEqual(["in_transit"]);
  });

  it("throws NotFoundError for an unknown id", async () => {
    expect(await errorOf(makeService(makeRepository()).getDetail(9))).toBeInstanceOf(NotFoundError);
  });
});

describe("ReturnService.transition", () => {
  it("walks submitted → approved → in_transit → received → resolved and returns the updated item", async () => {
    const service = makeService(makeRepository([makeRequest()]));

    for (const status of ["approved", "in_transit", "received", "resolved"] as const) {
      const item = await service.transition(1, status, undefined, AGENT);
      expect(item.status).toBe(status);
    }

    expect((await service.getDetail(1)).events.map((event) => event.toStatus)).toEqual([
      "approved",
      "in_transit",
      "received",
      "resolved",
    ]);
  });

  it("throws a 404 NotFoundError before any write when the request does not exist", async () => {
    const repository = makeRepository();
    const transition = vi.spyOn(repository, "transition");

    const error = await errorOf(makeService(repository).transition(99, "approved", undefined, AGENT));

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "Return 99 not found" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("throws a 409 carrying the stored status for a forbidden move, and writes nothing", async () => {
    const repository = makeRepository([makeRequest({ status: "approved" })]);

    const error = await errorOf(makeService(repository).transition(1, "rejected", LONG_NOTE.repeat(2), AGENT));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, fieldErrors: { status: "approved" } });
    expect(repository.events).toEqual([]);
  });

  it("answers 409 for a request whose stored status is unknown", async () => {
    const repository = makeRepository([makeRequest({ status: "unknown" })]);

    const error = await errorOf(makeService(repository).transition(1, "approved", undefined, AGENT));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, fieldErrors: { status: "unknown" } });
  });

  it("loses a race with a 409 carrying the winner's status and writes no second event", async () => {
    const repository = makeRepository([makeRequest()]);
    repository.beforeTransition = () => {
      repository.rows[0].status = "rejected";
    };

    const error = await errorOf(makeService(repository).transition(1, "approved", undefined, AGENT));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ fieldErrors: { status: "rejected" } });
    expect(repository.events).toEqual([]);
  });

  it("maps a request deleted between the read and the write to 404", async () => {
    const repository = makeRepository([makeRequest()]);
    repository.beforeTransition = () => {
      repository.rows.length = 0;
    };

    expect(await errorOf(makeService(repository).transition(1, "approved", undefined, AGENT))).toBeInstanceOf(NotFoundError);
  });

  describe("decision note", () => {
    it("rejects a reject with 29 trimmed characters and accepts exactly 30", async () => {
      const repository = makeRepository([makeRequest()]);
      const service = makeService(repository);

      const error = await errorOf(service.transition(1, "rejected", `  ${"a".repeat(29)}  `, AGENT));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ status: 400, fieldErrors: { decisionNote: expect.any(String) } });
      expect(repository.events).toEqual([]);
      expect((await service.transition(1, "rejected", "a".repeat(30), AGENT)).status).toBe("rejected");
    });

    it("requires a note to reject", async () => {
      const error = await errorOf(makeService(makeRepository([makeRequest()])).transition(1, "rejected", undefined, AGENT));

      expect(error).toMatchObject({ status: 400, code: "validation_error" });
    });

    it("stores the trimmed note on approval and none when it is blank or absent", async () => {
      const repository = makeRepository([makeRequest({ id: 1 }), makeRequest({ id: 2 }), makeRequest({ id: 3 })]);
      const service = makeService(repository);

      await service.transition(1, "approved", `  ${LONG_NOTE}\n`, AGENT);
      await service.transition(2, "approved", "   ", AGENT);
      await service.transition(3, "approved", undefined, AGENT);

      expect(repository.notes.get(1)).toBe(LONG_NOTE);
      expect(repository.notes.get(2)).toBeNull();
      expect(repository.notes.get(3)).toBeNull();
    });

    it("rejects a note sent with any other target status, even when the move would be allowed", async () => {
      const repository = makeRepository([makeRequest({ status: "approved" })]);

      const error = await errorOf(makeService(repository).transition(1, "in_transit", LONG_NOTE, AGENT));

      expect(error).toMatchObject({ status: 400, fieldErrors: { decisionNote: expect.any(String) } });
      expect(repository.events).toEqual([]);
    });

    it("checks the note (400) before the move (409)", async () => {
      const repository = makeRepository([makeRequest({ status: "approved" })]);

      const error = await errorOf(makeService(repository).transition(1, "resolved", LONG_NOTE, AGENT));

      expect(error).toBeInstanceOf(ValidationError);
    });

    it("leaves the stored note unchanged by a later move", async () => {
      const repository = makeRepository([makeRequest()]);
      const service = makeService(repository);
      await service.transition(1, "approved", LONG_NOTE, AGENT);

      await service.transition(1, "in_transit", undefined, AGENT);
      await service.transition(1, "received", undefined, AGENT);

      expect(repository.notes.get(1)).toBe(LONG_NOTE);
      expect(repository.rows[0].hasDecisionNote).toBe(true);
    });

    it("never puts the note in an error message or in the 409/404 detail", async () => {
      const repository = makeRepository([makeRequest({ status: "approved" })]);
      const service = makeService(repository);

      const conflict = await errorOf(service.transition(1, "rejected", SECRET_NOTE, AGENT));
      const missing = await errorOf(service.transition(9, "approved", SECRET_NOTE, AGENT));
      const short = await errorOf(service.transition(1, "rejected", "secret short", AGENT));

      for (const error of [conflict, missing, short]) {
        expect(JSON.stringify({ message: (error as Error).message, fields: (error as ConflictError).fieldErrors })).not.toMatch(
          /secret/i,
        );
      }
    });
  });
});

describe("returnStatusUpdateSchema", () => {
  const parse = (value: unknown) => returnStatusUpdateSchema.safeParse(value);

  it("accepts a status alone and trims the note", () => {
    expect(parse({ status: "approved" })).toMatchObject({ success: true, data: { status: "approved" } });
    expect(parse({ status: "approved", decisionNote: `  ${LONG_NOTE}  ` })).toMatchObject({
      success: true,
      data: { status: "approved", decisionNote: LONG_NOTE },
    });
  });

  it("drops a blank approval note", () => {
    expect(parse({ status: "approved", decisionNote: "  " })).toMatchObject({ success: true, data: { status: "approved" } });
  });

  it("rejects an unknown or legacy status", () => {
    for (const status of ["requested", "refunded", "nope", undefined]) {
      expect(parse({ status }).success).toBe(false);
    }
  });

  it("reports a short reject note and a note on another status under decisionNote", () => {
    for (const body of [
      { status: "rejected" },
      { status: "rejected", decisionNote: "too short" },
      { status: "in_transit", decisionNote: LONG_NOTE },
      { status: "resolved", decisionNote: "" },
    ]) {
      const result = parse(body);
      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toEqual(["decisionNote"]);
    }
  });
});

describe("returnListQuerySchema", () => {
  const parse = (value: unknown) => returnListQuerySchema.safeParse(value);

  it("accepts the nine statuses, unknown, and no filter", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ status: "unknown" }).success).toBe(true);
    for (const status of RETURN_STATUSES) expect(parse({ status }).success).toBe(true);
  });

  it("rejects anything else", () => {
    for (const status of ["requested", "", "SUBMITTED", "all"]) expect(parse({ status }).success).toBe(false);
  });
});

describe("ReturnService.transition mail", () => {
  const NOW = new Date("2026-11-06T10:00:00Z");

  it("sends exactly one return_status_changed with the RMA and new status", async () => {
    const mail = makeMailPort();
    const service = makeService(makeRepository([makeRequest()]), NOW, mail);
    await service.transition(1, "approved", LONG_NOTE, AGENT);
    expect(mail.sent).toEqual([
      {
        template: "return_status_changed",
        to: "customer@example.com",
        data: { rma: "RMA-2026-00001", status: "approved" },
      },
    ]);
  });

  it("sends nothing when the transition is rejected", async () => {
    const mail = makeMailPort();
    const service = makeService(makeRepository([makeRequest()]), NOW, mail);
    await errorOf(service.transition(1, "resolved", undefined, AGENT));
    expect(mail.sent).toHaveLength(0);
  });

  const failures: [string, MailPort][] = [
    [
      "throws synchronously",
      {
        send: () => {
          throw new Error("smtp down for customer@example.com");
        },
      },
    ],
    ["rejects", { send: () => Promise.reject(new Error("smtp down for customer@example.com")) }],
  ];

  it.each(failures)("swallows and logs a port that %s", async (_name, port) => {
    const error = vi.fn();
    const service = makeService(makeRepository([makeRequest()]), NOW, port, { error });
    const item = await service.transition(1, "approved", LONG_NOTE, AGENT);
    expect(item.status).toBe("approved");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("mail send failed", {
      template: "return_status_changed",
      to: "c***@example.com",
      error: "Error",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("customer@example.com");
  });
});

describe("ReturnService.transition identity", () => {
  it("records the acting agent on the timeline event", async () => {
    const repository = makeRepository([makeRequest()]);

    await makeService(repository).transition(1, "approved", LONG_NOTE, { id: 42, permissions: [] });

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]).toMatchObject({ actor: "agent", agentId: 42, toStatus: "approved" });
  });

  it("passes the agent id to the repository only after the note, existence and move checks", async () => {
    const repository = makeRepository([makeRequest()]);
    const spy = vi.spyOn(repository, "transition");
    const service = makeService(repository);

    await errorOf(service.transition(1, "rejected", undefined, AGENT));
    await errorOf(service.transition(99, "approved", undefined, AGENT));
    await errorOf(service.transition(1, "resolved", undefined, AGENT));
    expect(spy).not.toHaveBeenCalled();

    await service.transition(1, "approved", undefined, AGENT);
    expect(spy).toHaveBeenCalledWith(1, "submitted", "approved", null, 7);
  });
});

describe("ReturnService.transition approval limit (R11)", () => {
  const refund = (amountMinor: number, overrides: Partial<ReturnRequest> = {}) =>
    makeRequest({ resolution: "refund", resolutionAmount: money(amountMinor), ...overrides });

  it("lets any agent approve a refund of exactly the limit", async () => {
    const repository = makeRepository([refund(200000)]);

    const item = await makeService(repository).transition(1, "approved", undefined, AGENT);

    expect(item.status).toBe("approved");
  });

  it("refuses an agent without MANAGE_RULES one grosz above the limit with 403 approval_required, writing nothing", async () => {
    const repository = makeRepository([refund(200001)]);
    const spy = vi.spyOn(repository, "transition");

    const error = await errorOf(makeService(repository).transition(1, "approved", undefined, AGENT));

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403, code: "approval_required" });
    expect(spy).not.toHaveBeenCalled();
    expect(repository.events).toHaveLength(0);
  });

  it("lets a MANAGE_RULES agent approve above the limit", async () => {
    const repository = makeRepository([refund(900000)]);

    const item = await makeService(repository).transition(1, "approved", undefined, MANAGER);

    expect(item.status).toBe("approved");
    expect(repository.events[0]).toMatchObject({ agentId: 8 });
  });

  it("never gates store credit, exchange or a request without a resolution", async () => {
    const repository = makeRepository([
      makeRequest({ id: 1, resolution: "store_credit", resolutionAmount: money(900000) }),
      makeRequest({ id: 2, resolution: "exchange", resolutionAmount: null }),
      makeRequest({ id: 3 }),
    ]);
    const service = makeService(repository);

    for (const id of [1, 2, 3]) expect((await service.transition(id, "approved", undefined, AGENT)).status).toBe("approved");
  });

  it("does not gate rejecting a large refund", async () => {
    const repository = makeRepository([refund(900000)]);

    const item = await makeService(repository).transition(1, "rejected", LONG_NOTE, AGENT);

    expect(item.status).toBe("rejected");
  });

  it("follows the documented check order: note 400, existence 404, move 409, approval 403, then compare-and-set 409", async () => {
    const repository = makeRepository([refund(900000), refund(900000, { id: 2, status: "approved" })]);
    const service = makeService(repository);

    // 400 first: a rejection without a note, even on a request the agent could not approve anyway.
    expect(await errorOf(service.transition(1, "rejected", undefined, AGENT))).toBeInstanceOf(ValidationError);
    // 404 before 403.
    expect(await errorOf(service.transition(99, "approved", undefined, AGENT))).toBeInstanceOf(NotFoundError);
    // 409 (move not allowed from approved) before 403.
    expect(await errorOf(service.transition(2, "approved", undefined, AGENT))).toBeInstanceOf(ConflictError);
    // 403 once the move is allowed.
    expect(await errorOf(service.transition(1, "approved", undefined, AGENT))).toMatchObject({ code: "approval_required" });

    // The manager passes the approval check, then a stale status is the repository's compare-and-set 409.
    repository.beforeTransition = () => {
      repository.rows[0].status = "rejected";
    };
    const stale = await errorOf(service.transition(1, "approved", undefined, MANAGER));
    expect(stale).toBeInstanceOf(ConflictError);
    expect(stale).toMatchObject({ code: "conflict" });
  });
});


describe("ReturnService rules recommendations", () => {
  const ON: RecommendationConfig = { enabled: true, rules: BRIEF_RULES };
  const small = () => makeRequest({ resolution: "refund", resolutionAmount: money(10000) });
  const serviceFor = (repository: Fake, config?: RecommendationConfig) =>
    makeService(repository, undefined, undefined, undefined, config);

  it("attaches no recommendation while the flag is off", async () => {
    const detail = await serviceFor(makeRepository([small()])).getDetail(1);

    expect(detail).not.toHaveProperty("recommendation");
  });

  it("attaches the recommendation to a pending request when the flag is on", async () => {
    const detail = await serviceFor(makeRepository([small()]), ON).getDetail(1);

    expect(detail.recommendation).toMatchObject({ recommended: "approve", ruleIds: ["R08"] });
  });

  it("attaches none once the request is no longer awaiting a decision", async () => {
    const detail = await serviceFor(makeRepository([{ ...small(), status: "approved" }]), ON).getDetail(1);

    expect(detail).not.toHaveProperty("recommendation");
  });

  it("stores a followed comparison when the agent approves a recommended request", async () => {
    const repository = makeRepository([small()]);

    await serviceFor(repository, ON).transition(1, "approved", undefined, AGENT);

    expect(repository.comparisons).toEqual([{ id: 1, recommended: "approve", ruleIds: ["R08"], actualStatus: "approved", followed: true }]);
  });

  it("stores a not-followed comparison when the agent rejects a recommended request", async () => {
    const repository = makeRepository([small()]);

    await serviceFor(repository, ON).transition(1, "rejected", LONG_NOTE, AGENT);

    expect(repository.comparisons).toMatchObject([{ followed: false, actualStatus: "rejected" }]);
  });

  it("stores followed as null when nothing was recommended", async () => {
    const repository = makeRepository([makeRequest({ resolution: "exchange", resolutionAmount: null })]);

    await serviceFor(repository, ON).transition(1, "approved", undefined, AGENT);

    expect(repository.comparisons).toEqual([{ id: 1, recommended: "none", ruleIds: [], actualStatus: "approved", followed: null }]);
  });

  it("stores nothing for non-decision moves or while the flag is off", async () => {
    const approved = makeRepository([{ ...small(), status: "approved" }]);
    await serviceFor(approved, ON).transition(1, "in_transit", undefined, AGENT);
    const off = makeRepository([small()]);
    await serviceFor(off).transition(1, "approved", undefined, AGENT);

    expect(approved.comparisons).toEqual([]);
    expect(off.comparisons).toEqual([]);
  });
});

describe("ReturnService.listInbox rules hints", () => {
  const ON: RecommendationConfig = { enabled: true, rules: BRIEF_RULES };
  const row = (id: number, zl: number | null, overrides: Partial<ReturnRequest> = {}) =>
    makeRequest({ id, resolution: "refund", resolutionAmount: zl === null ? null : money(zl * 100), ...overrides });
  const inboxWith = async (rows: ReturnRequest[], config?: RecommendationConfig) => {
    const repository = makeRepository();
    repository.listInbox = async () => ({ rows, total: rows.length, page: 1, pageCount: 1 });
    return (await makeService(repository, undefined, undefined, undefined, config).listInbox({})).rows;
  };

  it("adds no hint while the flag is off", async () => {
    const [item] = await inboxWith([row(1, 50)]);

    expect(item).not.toHaveProperty("recommendApprove");
    expect(item).not.toHaveProperty("assignManager");
  });

  it("flags a small pending return for approval (R08) and a 2000 zł one for a manager (R10c)", async () => {
    const [small, large, middle] = await inboxWith([row(1, 150), row(2, 2000), row(3, 800)], ON);

    expect(small).toMatchObject({ recommendApprove: true, assignManager: false });
    expect(large).toMatchObject({ recommendApprove: false, assignManager: true });
    expect(middle).toMatchObject({ recommendApprove: false, assignManager: false });
  });

  it("flags a small pending complaint for approval (R09)", async () => {
    const [item] = await inboxWith([row(1, 60, { kind: "complaint" })], ON);

    expect(item).toMatchObject({ recommendApprove: true });
  });

  it("adds nothing to requests that are not awaiting a decision or have no amount", async () => {
    const [decided, exchange] = await inboxWith([row(1, 50, { status: "approved" }), row(2, null, { resolution: "exchange" })], ON);

    expect(decided).not.toHaveProperty("recommendApprove");
    expect(exchange).toMatchObject({ recommendApprove: false, assignManager: false });
  });
});
