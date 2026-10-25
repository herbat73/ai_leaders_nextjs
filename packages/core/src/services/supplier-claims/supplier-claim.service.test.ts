import { describe, expect, it, vi } from "vitest";

import { money } from "../../domain/money";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../errors";
import { supplierClaimAnswerSchema, supplierClaimCreateSchema } from "../../validators/supplier-claims/supplier-claim.schema";
import type { MailMessage, MailPort } from "../mail/mail.port";
import type { ReturnDetail, ReturnItem, ReturnRepository, ReturnRequest } from "../returns/types";
import type { Supplier, SupplierRepository } from "../suppliers/types";
import { composeSupplierClaim } from "./compose";
import { SupplierClaimService } from "./supplier-claim.service";
import type { StoredSupplierClaimStatus, SupplierClaim, SupplierClaimRepository, SupplierClaimTransitionOutcome } from "./types";

const NOW = new Date("2026-11-05T10:00:00Z");
const AGENT = { id: 7, email: "ula@sklep.example", displayName: "Ula Testowa" };
const ITEM: ReturnItem = {
  lineRef: "L1",
  sku: "KET-1",
  name: "Czajnik elektryczny",
  quantity: 2,
  unitPrice: money(19990),
  reasonCode: "defective",
  comment: null,
  serialNumber: "SN-42",
};

function request(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 1,
    rma: "RMA-2026-00001",
    kind: "complaint",
    orderNumber: "PL-10001",
    customerEmail: "customer@example.com",
    reason: null,
    status: "received",
    hasDecisionNote: false,
    defectDescription: "Grzałka przestała działać po tygodniu.",
    defectDiscoveredOn: "2026-10-20",
    defectConfirmed: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const SUPPLIER: Supplier = { id: 3, name: "Alfa", email: "claims@alfa.example", guidelines: null, active: true, createdAt: NOW, updatedAt: NOW };

function setup(options: { req?: ReturnRequest | null; supplier?: Supplier | null; delivers?: boolean; mailFails?: boolean } = {}) {
  const claims: SupplierClaim[] = [];
  const sent: MailMessage[] = [];
  const logger = { error: vi.fn() };
  const req = options.req === undefined ? request() : options.req;
  const returns = {
    findDetail: async (): Promise<ReturnDetail | null> => (req ? { request: req, decisionNote: null, items: [ITEM], events: [] } : null),
  } as unknown as ReturnRepository;
  const suppliers = { findById: async (id: number) => (options.supplier === undefined ? SUPPLIER : options.supplier)?.id === id ? (options.supplier ?? SUPPLIER) : null } as unknown as SupplierRepository;
  const repo: SupplierClaimRepository = {
    create: async (input) => {
      const claim: SupplierClaim = {
        id: claims.length + 1,
        ref: `SC-2026-${String(claims.length + 1).padStart(5, "0")}`,
        returnRequestId: input.returnRequestId,
        supplierId: input.supplierId,
        status: "draft",
        subject: input.subject,
        body: input.body,
        createdByAgentId: input.agentId,
        sentAt: null,
        answeredAt: null,
        creditAmount: null,
        answerNote: null,
        creditedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      claims.push(claim);
      return claim;
    },
    findById: async (id) => claims.find((c) => c.id === id) ?? null,
    findByReturnRequest: async (id) => claims.find((c) => c.returnRequestId === id) ?? null,
    list: async () => [],
    findDetail: async () => null,
    transition: async (id, from, to, _agent, answer): Promise<SupplierClaimTransitionOutcome> => {
      const claim = claims.find((c) => c.id === id);
      if (!claim) return { result: "not_found" };
      if (claim.status !== from) return { result: "conflict", currentStatus: claim.status as StoredSupplierClaimStatus };
      claim.status = to;
      if (answer?.creditAmount) claim.creditAmount = answer.creditAmount;
      return { result: "moved", claim };
    },
  };
  const mailPort: MailPort = {
    delivers: options.delivers ?? true,
    send: (message) => {
      if (options.mailFails) throw new Error("smtp down");
      sent.push(message);
    },
  };
  const service = new SupplierClaimService({
    supplierClaimRepository: repo,
    supplierRepository: suppliers,
    returnRepository: returns,
    mailPort,
    logger,
  });
  return { service, claims, sent, logger };
}

const create = { returnId: 1, supplierId: 3, agentNote: null };
const fieldsOf = (error: unknown) => (error as ValidationError).fields;

describe("SupplierClaimService.create", () => {
  it("stores the composed claim and sends it from the shared sender with the agent as reply-to", async () => {
    const { service, claims, sent } = setup();
    const result = await service.create(create, AGENT);

    expect(result.delivery).toBe("sent");
    expect(result.claim.status).toBe("sent");
    expect(claims[0]?.subject).toBe("Reklamacja RMA-2026-00001: Czajnik elektryczny");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ template: "supplier_claim", to: "claims@alfa.example", replyTo: "ula@sklep.example" });
    expect(sent[0]?.data.body).toContain("SN-42");
  });

  it("never puts the customer's e-mail address in the stored or sent text", async () => {
    const { service, claims, sent } = setup();
    await service.create(create, AGENT);
    expect(JSON.stringify([claims, sent])).not.toContain("customer@example.com");
  });

  it("keeps a draft when the transport does not deliver", async () => {
    const { service, sent } = setup({ delivers: false });
    const result = await service.create(create, AGENT);
    expect(result).toMatchObject({ delivery: "not_configured", claim: { status: "draft" } });
    expect(sent).toEqual([]);
  });

  it("keeps a draft and logs without the address when sending fails", async () => {
    const { service, logger } = setup({ mailFails: true });
    const result = await service.create(create, AGENT);
    expect(result).toMatchObject({ delivery: "failed", claim: { status: "draft" } });
    expect(logger.error).toHaveBeenCalledWith("mail send failed", { template: "supplier_claim", to: "c***@alfa.example", error: "Error" });
  });

  it.each([
    ["an unknown complaint", { req: null }, NotFoundError],
    ["a return", { req: request({ kind: "return" }) }, ValidationError],
    ["an unconfirmed defect", { req: request({ defectConfirmed: null }) }, ValidationError],
    ["a defect found absent", { req: request({ defectConfirmed: false }) }, ValidationError],
    ["an unknown supplier", { supplier: null }, ValidationError],
    ["an inactive supplier", { supplier: { ...SUPPLIER, active: false } }, ValidationError],
  ])("refuses %s", async (_name, options, errorType) => {
    const { service, claims } = setup(options);
    await expect(service.create(create, AGENT)).rejects.toBeInstanceOf(errorType);
    expect(claims).toEqual([]);
  });

  it("names the reason in the field errors", async () => {
    const error = await setup({ req: request({ defectConfirmed: null }) }).service.create(create, AGENT).catch((e: unknown) => e);
    expect(fieldsOf(error)).toEqual({ returnId: "defect_not_confirmed" });
  });

  it("answers 409 claim_exists for a second claim", async () => {
    const { service } = setup();
    await service.create(create, AGENT);
    const error = await service.create(create, AGENT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 409, code: "claim_exists" });
  });
});

describe("SupplierClaimService.send", () => {
  it("retries a draft and sends once the transport delivers", async () => {
    const first = setup({ delivers: false });
    await first.service.create(create, AGENT);
    // Same fakes, a delivering transport this time.
    const second = setup();
    await second.service.create(create, AGENT);
    expect(second.sent).toHaveLength(1);
  });

  it("refuses with 409 mail_not_configured and leaves the draft", async () => {
    const { service, claims } = setup({ delivers: false });
    await service.create(create, AGENT);
    const error = await service.send(1, AGENT).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "mail_not_configured" });
    expect(claims[0]?.status).toBe("draft");
  });

  it("answers 502 mail_failed when the mail server fails", async () => {
    const { service, claims } = setup({ mailFails: true });
    await service.create(create, AGENT);
    const error = await service.send(1, AGENT).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: "mail_failed" });
    expect(claims[0]?.status).toBe("draft");
  });

  it("refuses a claim that was already sent, and an unknown one", async () => {
    const { service } = setup();
    await service.create(create, AGENT);
    expect(await service.send(1, AGENT).catch((e: unknown) => e)).toBeInstanceOf(ConflictError);
    expect(await service.send(99, AGENT).catch((e: unknown) => e)).toBeInstanceOf(NotFoundError);
  });
});

describe("SupplierClaimService.recordAnswer", () => {
  async function sentClaim() {
    const fixture = setup();
    await fixture.service.create(create, AGENT);
    return fixture;
  }

  it("records an acceptance within the claimed value, then the credit booking", async () => {
    const { service, claims } = await sentClaim();
    const accepted = await service.recordAnswer(1, { status: "accepted", note: null, creditAmount: money(39980) }, AGENT);
    expect(accepted).toMatchObject({ status: "accepted", creditAmount: { amountMinor: 39980 } });
    await service.recordAnswer(1, { status: "credited", note: null }, AGENT);
    expect(claims[0]?.status).toBe("credited");
  });

  it("refuses a credit above the value of the claimed products", async () => {
    const { service, claims } = await sentClaim();
    const error = await service.recordAnswer(1, { status: "accepted", note: null, creditAmount: money(39981) }, AGENT).catch((e: unknown) => e);
    expect(fieldsOf(error)).toEqual({ creditAmount: "above_claim_value" });
    expect(claims[0]?.status).toBe("sent");
  });

  it("refuses answering a draft or reopening a rejection", async () => {
    const draft = setup({ delivers: false });
    await draft.service.create(create, AGENT);
    expect(await draft.service.recordAnswer(1, { status: "rejected", note: "x".repeat(20) }, AGENT).catch((e: unknown) => e)).toBeInstanceOf(ConflictError);

    const { service } = await sentClaim();
    await service.recordAnswer(1, { status: "rejected", note: "Uszkodzenie mechaniczne po stronie klienta" }, AGENT);
    expect(await service.recordAnswer(1, { status: "accepted", note: null, creditAmount: money(100) }, AGENT).catch((e: unknown) => e)).toBeInstanceOf(ConflictError);
  });

  it("answers 404 for an unknown claim", async () => {
    const { service } = setup();
    expect(await service.recordAnswer(5, { status: "rejected", note: "x".repeat(20) }, AGENT).catch((e: unknown) => e)).toBeInstanceOf(NotFoundError);
  });
});

describe("composeSupplierClaim", () => {
  const base = {
    rma: "RMA-2026-00009",
    orderNumber: "PL-10009",
    items: [ITEM, { ...ITEM, lineRef: "L2", name: "Toster", serialNumber: null, quantity: 1 }],
    defectDescription: "Nie włącza się.",
    defectDiscoveredOn: "2026-10-20",
    supplierName: "Alfa",
    agentNote: null,
    agent: { displayName: "Ula", email: "ula@sklep.example" },
  };

  it("lists items with serial numbers, the value, the defect and who to answer", () => {
    const { subject, body } = composeSupplierClaim(base);
    expect(subject).toBe("Reklamacja RMA-2026-00009: Czajnik elektryczny (+1)");
    expect(body).toContain("- Czajnik elektryczny (SKU: KET-1), 2 szt., cena jedn.");
    expect(body).toContain("numer seryjny: SN-42");
    expect(body).not.toContain("Toster (SKU: KET-1), 1 szt., cena jedn. 199,90 zł, numer seryjny");
    expect(body).toContain("Nie włącza się.");
    expect(body).toContain("Wada zauważona: 20 października 2026");
    expect(body).toContain("ula@sklep.example");
  });

  it("adds the agent's note and shortens a long name in the subject", () => {
    const { subject, body } = composeSupplierClaim({ ...base, items: [{ ...ITEM, name: "N".repeat(80) }], agentNote: "Proszę o pilną odpowiedź." });
    expect(subject.length).toBeLessThan(120);
    expect(subject).toContain("…");
    expect(body).toContain("Uwagi: Proszę o pilną odpowiedź.");
  });
});

describe("claim schemas", () => {
  it("normalises an empty note to null", () => {
    expect(supplierClaimCreateSchema.parse({ returnId: 1, supplierId: 2, agentNote: "  " })).toEqual({ returnId: 1, supplierId: 2, agentNote: null });
  });

  it("parses a typed amount and requires it only for an acceptance", () => {
    expect(supplierClaimAnswerSchema.parse({ status: "accepted", creditAmount: "149,99" })).toEqual({ status: "accepted", note: null, creditAmount: money(14999) });
    expect(supplierClaimAnswerSchema.safeParse({ status: "accepted" }).success).toBe(false);
    expect(supplierClaimAnswerSchema.safeParse({ status: "accepted", creditAmount: 0 }).success).toBe(false);
    expect(supplierClaimAnswerSchema.safeParse({ status: "credited", creditAmount: 10 }).success).toBe(false);
    expect(supplierClaimAnswerSchema.parse({ status: "credited" })).toEqual({ status: "credited", note: null });
  });

  it("needs a reason of at least 20 characters for a rejection", () => {
    expect(supplierClaimAnswerSchema.safeParse({ status: "rejected", note: "za krótko" }).success).toBe(false);
    expect(supplierClaimAnswerSchema.parse({ status: "rejected", note: "Uszkodzenie mechaniczne klienta" }).status).toBe("rejected");
  });
});
