import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../errors";
import { isReturnStatus, ReturnService } from "./return.service";
import type { NewReturnRequest, ReturnRepository, ReturnRequest, ReturnStatus } from "./types";

const NOW = new Date("2026-10-22T10:00:00Z");

function makeRequest(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 1,
    orderNumber: "ORD-1",
    customerEmail: "customer@example.com",
    reason: "Too small",
    status: "requested",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** In-memory stand-in for the `db` repository port. */
function makeRepository(initial: ReturnRequest[] = []): ReturnRepository {
  const rows = [...initial];
  return {
    list: async () => [...rows],
    findById: async (id) => rows.find((row) => row.id === id) ?? null,
    create: async (input: NewReturnRequest) => {
      const row = makeRequest({ ...input, id: rows.length + 1 });
      rows.push(row);
      return row;
    },
    updateStatus: async (id, status: ReturnStatus) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return null;
      row.status = status;
      return row;
    },
  };
}

describe("isReturnStatus", () => {
  it("accepts every known status", () => {
    for (const status of ["requested", "approved", "rejected", "received", "refunded"]) {
      expect(isReturnStatus(status)).toBe(true);
    }
  });

  it("rejects unknown values and non-strings", () => {
    expect(isReturnStatus("shipped")).toBe(false);
    expect(isReturnStatus(undefined)).toBe(false);
    expect(isReturnStatus(1)).toBe(false);
  });
});

describe("ReturnService", () => {
  it("lists what the repository holds", async () => {
    const service = new ReturnService({ returnRepository: makeRepository([makeRequest()]) });

    expect(await service.list()).toHaveLength(1);
  });

  it("creates a request through the repository", async () => {
    const service = new ReturnService({ returnRepository: makeRepository() });

    const created = await service.create({ orderNumber: "ORD-2", customerEmail: "a@example.com", reason: "Damaged" });

    expect(created).toMatchObject({ id: 1, orderNumber: "ORD-2", status: "requested" });
  });

  it("returns the updated request when changing status", async () => {
    const service = new ReturnService({ returnRepository: makeRepository([makeRequest()]) });

    const updated = await service.updateStatus(1, "approved");

    expect(updated.status).toBe("approved");
  });

  it("throws a 404 NotFoundError when the request does not exist", async () => {
    const service = new ReturnService({ returnRepository: makeRepository() });

    const error = await service.updateStatus(99, "approved").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "Return 99 not found" });
  });
});
