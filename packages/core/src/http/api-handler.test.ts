import { describe, expect, it, vi } from "vitest";

import { APP_ERROR_BRAND, ConflictError, ForbiddenError, isAppError, UnauthorizedError, ValidationError } from "../errors";
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

  describe("AppError from another copy of the module", () => {
    /** What a second bundled copy of `errors.ts` produces: same shape and brand, different class identity. */
    class ForeignAppError extends Error {
      readonly [APP_ERROR_BRAND] = true;
      constructor(readonly status: number, readonly code: string) {
        super("from another bundle");
      }
    }

    it("maps it like a native AppError instead of an opaque 500", async () => {
      const handler = apiHandler(async () => {
        throw new ForeignAppError(403, "approval_required");
      });

      const response = await handler(new Request("http://localhost/api/x"), context);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ ok: false, error: { code: "approval_required" } });
    });

    it("does not treat lookalikes without the brand, such as driver errors, as AppErrors", async () => {
      const driver = Object.assign(new Error("duplicate key"), { code: "23505", status: 409 });
      const logger = makeLogger();
      const response = await apiHandler(async () => {
        throw driver;
      }, { logger })(new Request("http://localhost/api/x"), context);

      expect(isAppError(driver)).toBe(false);
      expect(isAppError(new ConflictError("x"))).toBe(true);
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("authenticate hook", () => {
    const post = (headers: Record<string, string> = { "x-requested-with": "test" }) =>
      new Request("http://localhost/api/x", { method: "POST", headers });

    it("passes the principal to the handler as its last argument", async () => {
      const handler = apiHandler(async (_request, _context, principal: { id: number }) => ({ who: principal.id }), {
        authenticate: async () => ({ id: 7 }),
      });

      const response = await handler(new Request("http://localhost/api/x"), context);

      expect(await response.json()).toEqual({ ok: true, data: { who: 7 } });
    });

    it("maps a rejection to its status and never runs the handler", async () => {
      const run = vi.fn(async () => ({}));
      const handler = apiHandler(run, {
        authenticate: async () => {
          throw new UnauthorizedError();
        },
      });

      const response = await handler(new Request("http://localhost/api/x"), context);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ ok: false, error: { code: "unauthorized" } });
      expect(run).not.toHaveBeenCalled();
    });

    it("runs after the CSRF check: a cross-site request is a 403 without authenticating", async () => {
      const authenticate = vi.fn(async () => ({ id: 1 }));
      const handler = apiHandler(async () => ({}), { authenticate });

      const response = await handler(post({}), context);

      expect(response.status).toBe(403);
      expect(authenticate).not.toHaveBeenCalled();
    });

    it("runs before the handler, which is where the body gets parsed", async () => {
      const order: string[] = [];
      const handler = apiHandler(
        async () => {
          order.push("handler");
          return {};
        },
        {
          authenticate: async () => {
            order.push("authenticate");
            throw new ForbiddenError("no", "forbidden");
          },
        },
      );

      const response = await handler(post(), context);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
      expect(order).toEqual(["authenticate"]);
    });

    it("leaves a route without the option exactly as before (the handler's principal is undefined)", async () => {
      const seen: unknown[] = [];
      const handler = apiHandler(async (_request, _context, principal) => {
        seen.push(principal);
        return { ok: 1 };
      });

      const response = await handler(post(), context);

      expect(response.status).toBe(200);
      expect(seen).toEqual([undefined]);
    });

    it("logs an unexpected failure of the hook as an opaque 500", async () => {
      const logger = makeLogger();
      const handler = apiHandler(async () => ({}), {
        logger,
        authenticate: async () => {
          throw new Error("db down");
        },
      });

      const response = await handler(new Request("http://localhost/api/x"), context);

      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
