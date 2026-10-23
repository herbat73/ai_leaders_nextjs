import { describe, expect, it, vi } from "vitest";

import { ConflictError, ValidationError } from "../errors";
import { apiHandler } from "./api-handler";
import type { ApiLogger } from "./types";

const context = { params: Promise.resolve({}) };
const NOTE = "Customer wrote: my secret medical note 4711";

function makeLogger(): { error: ReturnType<typeof vi.fn<ApiLogger["error"]>> } {
  return { error: vi.fn<ApiLogger["error"]>() };
}

function contextsOf(logger: ReturnType<typeof makeLogger>): Record<string, unknown>[] {
  return logger.error.mock.calls.map(([, logged]) => logged ?? {});
}

/** Shaped like a database driver error: its own `code` and `constraint`, and bound values inside the message. */
class DriverException extends Error {
  readonly code = "23505";
  readonly constraint = "return_requests_rma_unique";
  constructor() {
    super(`insert into return_requests (decision_note) values ('${NOTE}') - duplicate key`);
    this.name = "UniqueConstraintViolationException";
  }
}

describe("apiHandler", () => {
  it("wraps a result in the success envelope", async () => {
    const response = await apiHandler(async () => ({ id: 1 }))(new Request("http://localhost/api/x"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { id: 1 } });
  });

  it("carries a ConflictError's field errors through the envelope", async () => {
    const handler = apiHandler(async () => {
      throw new ConflictError("Cannot move", { status: "approved" });
    });

    const response = await handler(new Request("http://localhost/api/x"), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "conflict", fieldErrors: { status: "approved" } },
    });
  });

  it("maps a ValidationError to 400 with its field errors", async () => {
    const handler = apiHandler(async () => {
      throw new ValidationError("Invalid", { decisionNote: "Too short" });
    });

    const response = await handler(new Request("http://localhost/api/x"), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { fieldErrors: { decisionNote: "Too short" } } });
  });

  describe("unexpected failures", () => {
    it("returns an opaque 500 and never logs the message, the stack or bound values", async () => {
      const logger = makeLogger();
      const handler = apiHandler(
        async () => {
          throw new DriverException();
        },
        { logger },
      );

      const response = await handler(new Request("http://localhost/api/returns/7?status=submitted"), context);

      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain(NOTE);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][0]).toBe("Unhandled API error");
      const [logged] = contextsOf(logger);
      expect(JSON.stringify(logged)).not.toContain("secret medical note");
      expect(JSON.stringify(logged)).not.toContain("insert into");
      expect(logged).toMatchObject({
        name: "UniqueConstraintViolationException",
        code: "23505",
        constraint: "return_requests_rma_unique",
        route: "/api/returns/7",
      });
    });

    it("logs the route without the query string", async () => {
      const logger = makeLogger();
      const handler = apiHandler(
        async () => {
          throw new Error("boom");
        },
        { logger },
      );

      await handler(new Request("http://localhost/api/returns?status=rejected"), context);

      const [logged] = contextsOf(logger);
      expect(logged.route).toBe("/api/returns");
      expect(JSON.stringify(logged)).not.toContain("rejected");
    });

    it("uses a valid x-request-id header and replaces an invalid one with a UUID", async () => {
      const logger = makeLogger();
      const handler = apiHandler(
        async () => {
          throw new Error("boom");
        },
        { logger },
      );

      await handler(new Request("http://localhost/api/x", { headers: { "x-request-id": "req-1.a_B" } }), context);
      await handler(new Request("http://localhost/api/x", { headers: { "x-request-id": "bad idé" } }), context);
      await handler(
        new Request("http://localhost/api/x", { headers: { "x-request-id": "a".repeat(65) } }),
        context,
      );

      const [valid, badChars, tooLong] = contextsOf(logger).map((logged) => logged.requestId);
      expect(valid).toBe("req-1.a_B");
      for (const replaced of [badChars, tooLong]) {
        expect(String(replaced)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    it("never returns the request id to the client", async () => {
      const handler = apiHandler(
        async () => {
          throw new Error("boom");
        },
        { logger: makeLogger() },
      );

      const response = await handler(
        new Request("http://localhost/api/x", { headers: { "x-request-id": "req-1" } }),
        context,
      );

      expect(response.headers.get("x-request-id")).toBeNull();
      expect(JSON.stringify(await response.json())).not.toContain("req-1");
    });

    it("logs a non-Error throw by type only", async () => {
      const logger = makeLogger();
      const handler = apiHandler(
        async () => {
          throw NOTE;
        },
        { logger },
      );

      await handler(new Request("http://localhost/api/x"), context);

      const [logged] = contextsOf(logger);
      expect(logged.name).toBe("string");
      expect(JSON.stringify(logged)).not.toContain(NOTE);
    });
  });
});
