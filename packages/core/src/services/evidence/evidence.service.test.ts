import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../errors";
import { RateLimiter } from "../../security/rate-limiter";
import { detectImageType, sanitizeLabel } from "./detect";
import { EvidenceService, EVIDENCE_UPLOAD_RULE, STAGED_FILE_TTL_MS } from "./evidence.service";
import type {
  EvidenceAuditEntry,
  EvidenceContent,
  NewEvidenceDownload,
  EvidenceFile,
  EvidenceLimits,
  EvidencePort,
  ImageSanitizerPort,
  InspectOutcome,
  MalwareScannerPort,
  SanitizeOutcome,
  ScanVerdict,
  StageOutcome,
} from "./types";

const NOW = new Date("2026-11-11T10:00:00Z");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

const LIMITS: EvidenceLimits = { maxFileBytes: 100, maxFilesPerRequest: 2, maxBytesPerOrder: 150, maxPixels: 1000 };

function setup(options: { scan?: ScanVerdict; inspect?: InspectOutcome; sanitize?: SanitizeOutcome; stage?: StageOutcome; recordDownload?: () => Promise<void> } = {}) {
  const downloads: NewEvidenceDownload[] = [];
  const stored: EvidenceFile[] = [];
  const calls: string[] = [];
  const staged: { staleBefore: Date; bytes: Uint8Array; label: string; sha256: string; contentType: string }[] = [];
  const port: EvidencePort = {
    stage: async (input, _limits, staleBefore) => {
      calls.push("stage");
      staged.push({ staleBefore, bytes: input.data, label: input.label, sha256: input.sha256, contentType: input.contentType });
      if (options.stage) return options.stage;
      const file: EvidenceFile = {
        id: "11111111-1111-4111-8111-111111111111",
        orderNumber: input.orderNumber,
        returnRequestId: null,
        contentType: input.contentType,
        byteSize: input.data.byteLength,
        sha256: input.sha256,
        label: input.label,
        createdAt: NOW,
      };
      stored.push(file);
      return { result: "stored", file };
    },
    find: async (id) => {
      const file = stored.find((candidate) => candidate.id === id);
      return file ? ({ file, data: new Uint8Array([1]) } satisfies EvidenceContent) : null;
    },
    attach: async () => ({ result: "invalid" }),
    recordDownload: async (input) => {
      if (options.recordDownload) return options.recordDownload();
      downloads.push(input);
    },
    listAudit: async (): Promise<EvidenceAuditEntry[]> => [
      { id: 1, evidenceFileId: "f", label: "a.jpg", action: "added", actor: "guest", agentName: null, createdAt: NOW },
    ],
    deleteStaged: async (orderNumber, id) => {
      const index = stored.findIndex((candidate) => candidate.id === id && candidate.orderNumber === orderNumber && candidate.returnRequestId === null);
      if (index < 0) return false;
      stored.splice(index, 1);
      return true;
    },
    deleteForRequest: async () => 0,
  };
  const scanner: MalwareScannerPort = {
    scan: async () => {
      calls.push("scan");
      return options.scan ?? { status: "clean" };
    },
  };
  const sanitizer: ImageSanitizerPort = {
    inspect: async (data) => {
      calls.push("inspect");
      return options.inspect ?? { status: "ok", info: { contentType: detectImageType(data) ?? "image/jpeg", width: 10, height: 10 } };
    },
    sanitize: async (data) => {
      calls.push("sanitize");
      return options.sanitize ?? { status: "ok", contentType: detectImageType(data) ?? "image/jpeg", data: new Uint8Array([...data]) };
    },
  };
  const logger = { error: vi.fn() };
  const service = new EvidenceService({
    evidencePort: port,
    malwareScanner: scanner,
    imageSanitizer: sanitizer,
    rateLimiter: new RateLimiter({ clock: () => NOW }),
    clock: () => NOW,
    logger,
    evidenceLimits: LIMITS,
  });
  return { service, calls, staged, stored, logger, downloads };
}

const upload = (service: EvidenceService, data: Uint8Array, name: string | null = "photo.jpg", ip = "1.1.1.1", order = "PL-10001") =>
  service.upload({ orderNumber: order, ip, readFile: async () => ({ data, name }) });

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    if (caught instanceof AppError) return caught;
    throw caught;
  }
  throw new Error("expected the call to fail");
}

describe("upload happy path and order of checks", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg"],
    ["PNG", PNG, "image/png"],
    ["WebP", WEBP, "image/webp"],
  ])("stores a %s and answers with id, size and type", async (_name, bytes, type) => {
    const { service } = setup();
    expect(await upload(service, bytes)).toEqual({ id: "11111111-1111-4111-8111-111111111111", byteSize: bytes.byteLength, contentType: type });
  });

  it("checks in the documented order: inspect, scan the original, sanitize, then store", async () => {
    const { service, calls } = setup();
    await upload(service, JPEG);
    expect(calls).toEqual(["inspect", "scan", "sanitize", "stage"]);
  });

  it("stores the re-encoded bytes with their SHA-256, never the original", async () => {
    const reencoded = new Uint8Array([0xff, 0xd8, 0xff, 9, 9]);
    const { service, staged } = setup({ sanitize: { status: "ok", contentType: "image/jpeg", data: reencoded } });
    await upload(service, JPEG);
    expect(staged[0]?.bytes).toBe(reencoded);
    expect(staged[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deletes staged files older than the guest session on the way in", async () => {
    const { service, staged } = setup();
    await upload(service, JPEG);
    expect(staged[0]?.staleBefore.getTime()).toBe(NOW.getTime() - STAGED_FILE_TTL_MS);
  });
});

describe("what is refused, and what is never reached", () => {
  it.each([
    ["SVG with script", SVG],
    ["HTML", HTML],
    ["plain text", new TextEncoder().encode("hello")],
    ["an empty file", new Uint8Array(0)],
  ])("rejects %s as not_an_image (400) before scanning", async (_name, bytes) => {
    const { service, calls } = setup();
    const refused = await failure(upload(service, bytes, "photo.jpg"));
    expect([refused.status, refused.code]).toEqual([400, "not_an_image"]);
    expect(calls).toEqual([]);
  });

  it("judges the content, not the file name or a declared type", async () => {
    const { service } = setup();
    const refused = await failure(upload(service, SVG, "innocent.png"));
    expect(refused.code).toBe("not_an_image");
  });

  it("rejects an oversize file as too_large (413) before any check", async () => {
    const { service, calls } = setup();
    const refused = await failure(upload(service, new Uint8Array(101).fill(0xff)));
    expect([refused.status, refused.code]).toEqual([413, "too_large"]);
    expect(calls).toEqual([]);
  });

  it("rejects an infected file as rejected (422), without sanitizing or storing it", async () => {
    const { service, calls, stored } = setup({ scan: { status: "infected" } });
    const refused = await failure(upload(service, JPEG));
    expect([refused.status, refused.code]).toEqual([422, "rejected"]);
    expect(calls).toEqual(["inspect", "scan"]);
    expect(stored).toEqual([]);
  });

  it("answers the same for an infected and an undecodable file", async () => {
    const infected = await failure(upload(setup({ scan: { status: "infected" } }).service, JPEG));
    const undecodable = await failure(upload(setup({ inspect: { status: "rejected" } }).service, JPEG));
    expect([undecodable.status, undecodable.code, undecodable.message]).toEqual([infected.status, infected.code, infected.message]);
  });

  it("rejects extreme dimensions found by the header inspection, before the scan", async () => {
    const { service, calls } = setup({ inspect: { status: "rejected" } });
    expect((await failure(upload(service, PNG))).code).toBe("rejected");
    expect(calls).toEqual(["inspect"]);
  });

  it("rejects a file whose decoded type differs from its magic bytes", async () => {
    const { service } = setup({ inspect: { status: "ok", info: { contentType: "image/png", width: 1, height: 1 } } });
    expect((await failure(upload(service, JPEG))).code).toBe("rejected");
  });

  it("rejects when the sanitizer returns something that is not an image of its stated type", async () => {
    const { service, stored } = setup({ sanitize: { status: "ok", contentType: "image/png", data: new Uint8Array([1, 2, 3]) } });
    expect((await failure(upload(service, JPEG))).code).toBe("rejected");
    expect(stored).toEqual([]);
  });
});

describe("fail closed when a checker is down (T-16)", () => {
  it.each([
    ["the scanner", { scan: { status: "unavailable" } } as const],
    ["the header inspection", { inspect: { status: "unavailable" } } as const],
    ["the sanitizer", { sanitize: { status: "unavailable" } } as const],
  ])("answers 503 scanner_unavailable and stores nothing when %s is down", async (_name, options) => {
    const { service, stored, logger } = setup(options);
    const refused = await failure(upload(service, JPEG));
    expect([refused.status, refused.code]).toEqual([503, "scanner_unavailable"]);
    expect(stored).toEqual([]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("quota (T-18)", () => {
  it("answers 409 quota_exceeded for the file count and for the order bytes, with different messages", async () => {
    const many = await failure(upload(setup({ stage: { result: "too_many_files" } }).service, JPEG));
    const full = await failure(upload(setup({ stage: { result: "quota_exceeded" } }).service, JPEG));
    expect([many.status, many.code]).toEqual([409, "quota_exceeded"]);
    expect([full.status, full.code]).toEqual([409, "quota_exceeded"]);
    expect(many.message).not.toBe(full.message);
  });

  it("throttles per order and client IP, and does not read the body of a throttled upload", async () => {
    const { service } = setup();
    for (let i = 0; i < EVIDENCE_UPLOAD_RULE.limit; i += 1) await upload(service, JPEG);
    const readFile = vi.fn(async () => ({ data: JPEG, name: "x.jpg" }));
    const refused = await failure(service.upload({ orderNumber: "PL-10001", ip: "1.1.1.1", readFile }));
    expect([refused.status, refused.code]).toEqual([429, "rate_limited"]);
    expect(readFile).not.toHaveBeenCalled();
    // Another IP and another order have their own budgets.
    await upload(service, JPEG, "x.jpg", "2.2.2.2");
    await upload(service, JPEG, "x.jpg", "1.1.1.1", "PL-10005");
  });
});

describe("read (T-17)", () => {
  async function stagedFor(order: string) {
    const ctx = setup();
    const result = await upload(ctx.service, JPEG, "a.jpg", "1.1.1.1", order);
    return { ...ctx, id: result.id };
  }

  it("lets an agent and the owning guest session read, and nobody else", async () => {
    const { service, id } = await stagedFor("PL-10001");
    expect((await service.read(id, { kind: "agent" })).file.id).toBe(id);
    expect((await service.read(id, { kind: "guest", orderNumber: "PL-10001" })).file.id).toBe(id);
    const foreign = await failure(service.read(id, { kind: "guest", orderNumber: "PL-10005" }));
    const unknown = await failure(service.read("00000000-0000-4000-8000-000000000000", { kind: "agent" }));
    expect([foreign.status, foreign.code, foreign.message]).toEqual([unknown.status, unknown.code, unknown.message]);
    expect(foreign.status).toBe(404);
  });
});

describe("audit of agent downloads (T-23)", () => {
  async function uploaded(ctx = setup()) {
    const { id } = await upload(ctx.service, JPEG, "a.jpg", "1.1.1.1", "PL-10001");
    return { ...ctx, id };
  }

  it("records an agent download with the file's order, its request and the agent", async () => {
    const { service, id, stored, downloads } = await uploaded();
    stored[0] = { ...(stored[0] as EvidenceFile), returnRequestId: 7 };
    await service.read(id, { kind: "agent", agentId: 42 });
    expect(downloads).toEqual([{ evidenceFileId: id, orderNumber: "PL-10001", returnRequestId: 7, agentId: 42 }]);
  });

  it("does not record the customer reading their own file, or an agent context without an id", async () => {
    const { service, id, downloads } = await uploaded();
    await service.read(id, { kind: "guest", orderNumber: "PL-10001" });
    await service.read(id, { kind: "agent" });
    expect(downloads).toEqual([]);
  });

  it("records nothing for a read that is refused: another order, unknown id", async () => {
    const { service, id, downloads } = await uploaded();
    await failure(service.read(id, { kind: "guest", orderNumber: "PL-10005" }));
    await failure(service.read("00000000-0000-4000-8000-000000000000", { kind: "agent", agentId: 42 }));
    expect(downloads).toEqual([]);
  });

  it("does not block the read when the audit write fails: the agent still gets the file, and the failure is logged without values", async () => {
    const ctx = setup({
      recordDownload: async () => {
        throw new Error("connection to 10.0.0.5 refused for customer anna.kowalska@example.pl");
      },
    });
    const { service, id, logger } = await uploaded(ctx);
    expect((await service.read(id, { kind: "agent", agentId: 42 })).file.id).toBe(id);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("anna.kowalska");
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("10.0.0.5");
  });

  it("hands the trail of a request to the caller", async () => {
    const { service } = setup();
    expect((await service.listAudit(7)).map((entry) => entry.action)).toEqual(["added"]);
  });
});

describe("removeStaged", () => {
  it("removes the customer's own staged file, and a second removal is a 404", async () => {
    const { service, stored } = setup();
    const { id } = await upload(service, JPEG, "a.jpg");
    await service.removeStaged("PL-10001", id);
    expect(stored).toEqual([]);
    expect((await failure(service.removeStaged("PL-10001", id))).status).toBe(404);
  });

  it("answers the same 404 for another order's file, an unknown id and an attached file", async () => {
    const { service, stored } = setup();
    const { id } = await upload(service, JPEG, "a.jpg");
    const foreign = await failure(service.removeStaged("PL-10005", id));
    const unknown = await failure(service.removeStaged("PL-10001", "00000000-0000-4000-8000-000000000000"));
    stored[0] = { ...(stored[0] as EvidenceFile), returnRequestId: 7 };
    const attached = await failure(service.removeStaged("PL-10001", id));
    for (const refused of [foreign, unknown, attached]) expect([refused.status, refused.code, refused.message]).toEqual([404, "not_found", foreign.message]);
    expect(stored).toHaveLength(1);
  });
});

describe("detectImageType and sanitizeLabel", () => {
  it("detects the three allowed types by their first bytes and nothing else", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // WAV
    expect(detectImageType(new Uint8Array(0))).toBeNull();
  });

  it.each([
    ["../../etc/passwd", "passwd"],
    ["C:\\Users\\a\\photo 1.jpg", "photo 1.jpg"],
    ['a"b<c>.jpg', "abc.jpg"],
    ["line\r\nbreak.jpg", "linebreak.jpg"],
    ["tab\there.png", "tabhere.png"],
    ["..", "zdjęcie"],
    ["", "zdjęcie"],
    [null, "zdjęcie"],
    ["x".repeat(300) + ".jpg", "x".repeat(120)],
  ])("cleans the label %j to %j", (input, expected) => {
    expect(sanitizeLabel(input)).toBe(expected);
  });
});
