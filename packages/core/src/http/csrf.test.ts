import { describe, expect, it, vi } from "vitest";

import { ConfigurationError, ForbiddenError } from "../errors";
import { apiHandler, okResponse } from "./api-handler";
import { assertSameOrigin, isSameOriginRequest, parseTrustProxy } from "./csrf";
import type { ApiLogger } from "./types";

const context = { params: Promise.resolve({}) };

function post(headers: Record<string, string> = {}, method = "POST"): Request {
  return new Request("http://app.test/api/x", { method, headers });
}
const ok = { "x-requested-with": "easyrms" };

describe("parseTrustProxy", () => {
  it("parses true and false in any environment", () => {
    expect(parseTrustProxy({ nodeEnv: "production", value: "true" })).toBe(true);
    expect(parseTrustProxy({ nodeEnv: "production", value: " FALSE " })).toBe(false);
    expect(parseTrustProxy({ nodeEnv: "development", value: "true" })).toBe(true);
  });

  it("defaults to false when unset outside production", () => {
    expect(parseTrustProxy({ nodeEnv: "development", value: undefined })).toBe(false);
    expect(parseTrustProxy({ nodeEnv: "test", value: undefined })).toBe(false);
    expect(parseTrustProxy({ nodeEnv: undefined, value: "garbage" })).toBe(false);
  });

  it("throws a configuration error in production when unset or invalid", () => {
    expect(() => parseTrustProxy({ nodeEnv: "production", value: undefined })).toThrow(ConfigurationError);
    expect(() => parseTrustProxy({ nodeEnv: "production", value: "" })).toThrow(ConfigurationError);
    expect(() => parseTrustProxy({ nodeEnv: "production", value: "yes" })).toThrow(ConfigurationError);
  });
});

describe("isSameOriginRequest", () => {
  it("rejects a request without x-requested-with", () => {
    expect(isSameOriginRequest(post({ origin: "http://app.test" }))).toBe(false);
    expect(isSameOriginRequest(post())).toBe(false);
  });

  it("accepts the header without an Origin, and the same origin", () => {
    expect(isSameOriginRequest(post(ok))).toBe(true);
    expect(isSameOriginRequest(post({ ...ok, origin: "http://app.test", host: "app.test" }))).toBe(true);
  });

  it("rejects a foreign origin, Origin: null and a port mismatch", () => {
    expect(isSameOriginRequest(post({ ...ok, origin: "http://evil.test", host: "app.test" }))).toBe(false);
    expect(isSameOriginRequest(post({ ...ok, origin: "null", host: "app.test" }))).toBe(false);
    expect(isSameOriginRequest(post({ ...ok, origin: "http://app.test:3001", host: "app.test:3000" }))).toBe(false);
    expect(isSameOriginRequest(post({ ...ok, origin: "http://app.test:3000", host: "app.test:3000" }))).toBe(true);
  });

  it("honours x-forwarded-host only when the proxy is trusted", () => {
    const headers = { ...ok, origin: "https://public.test", host: "internal:3000", "x-forwarded-host": "public.test" };
    expect(isSameOriginRequest(post(headers), { trustProxy: true })).toBe(true);
    expect(isSameOriginRequest(post(headers), { trustProxy: false })).toBe(false);
    expect(isSameOriginRequest(post(headers))).toBe(false);
  });

  it("does not let a spoofed x-forwarded-host pass without trust", () => {
    const headers = { ...ok, origin: "http://evil.test", host: "app.test", "x-forwarded-host": "evil.test" };
    expect(isSameOriginRequest(post(headers))).toBe(false);
  });

  it("assertSameOrigin throws ForbiddenError with csrf_rejected", () => {
    expect(() => assertSameOrigin(post())).toThrow(ForbiddenError);
    try {
      assertSameOrigin(post());
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: "csrf_rejected" });
    }
  });
});

describe("apiHandler CSRF check and passthrough", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s without the header with 403 csrf_rejected", async (method) => {
    const handler = vi.fn(async () => ({ id: 1 }));

    const response = await apiHandler(handler)(post({}, method), context);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "csrf_rejected" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a foreign origin and lets a same-origin mutation through with the plain envelope", async () => {
    const handler = apiHandler(async () => ({ id: 1 }), { status: 201 });

    const foreign = await handler(post({ ...ok, origin: "http://evil.test", host: "app.test" }), context);
    const same = await handler(post({ ...ok, origin: "http://app.test", host: "app.test" }), context);

    expect(foreign.status).toBe(403);
    expect(same.status).toBe(201);
    expect(await same.json()).toEqual({ ok: true, data: { id: 1 } });
  });

  it("leaves GET untouched", async () => {
    const response = await apiHandler(async () => "fine")(new Request("http://app.test/api/x"), context);

    expect(response.status).toBe(200);
  });

  it("evaluates a trustProxy function per mutating request, never for GET", async () => {
    const trustProxy = vi.fn(() => true);
    const handler = apiHandler(async () => "ok", { trustProxy });
    const headers = { ...ok, origin: "https://public.test", host: "internal", "x-forwarded-host": "public.test" };

    await handler(new Request("http://internal/api/x"), context);
    expect(trustProxy).not.toHaveBeenCalled();

    expect((await handler(post(headers), context)).status).toBe(200);
    expect((await handler(post(headers), context)).status).toBe(200);
    expect(trustProxy).toHaveBeenCalledTimes(2);
  });

  it("fails closed with an opaque 500 when the trustProxy function throws a configuration error", async () => {
    const error = vi.fn<ApiLogger["error"]>();
    const handler = apiHandler(async () => "ok", {
      logger: { error },
      trustProxy: () => parseTrustProxy({ nodeEnv: "production", value: undefined }),
    });

    // Creating the handler (route creation, as in `next build`) does not throw; GET does not need the flag.
    expect((await handler(new Request("http://app.test/api/x"), context)).status).toBe(200);
    const response = await handler(post(ok), context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(error).toHaveBeenCalledWith("Unhandled API error", expect.objectContaining({ name: "ConfigurationError" }));
  });

  it("passes a returned Response through unchanged, keeping status and headers", async () => {
    const handler = apiHandler(async () => okResponse({ id: 1 }, { status: 202, headers: { "set-cookie": "a=b; Path=/" } }));

    const response = await handler(post(ok), context);

    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toBe("a=b; Path=/");
    expect(await response.json()).toEqual({ ok: true, data: { id: 1 } });
  });
});
