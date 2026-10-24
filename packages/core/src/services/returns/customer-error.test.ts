import { describe, expect, it } from "vitest";

import { customerErrorKey } from "./customer-error";

describe("customerErrorKey", () => {
  it.each([
    "not_found",
    "rate_limited",
    "service_unavailable",
    "csrf_rejected",
    "network_error",
    "unexpected_response",
    "unauthorized",
    "validation_error",
  ])("keeps the known code %s", (code) => {
    expect(customerErrorKey(code)).toBe(code);
  });

  it("falls back to the HTTP status for an unknown code", () => {
    expect(customerErrorKey("weird", 404)).toBe("not_found");
    expect(customerErrorKey("weird", 429)).toBe("rate_limited");
    expect(customerErrorKey(undefined, 503)).toBe("service_unavailable");
    expect(customerErrorKey("weird", 401)).toBe("unauthorized");
  });

  it("answers generic otherwise", () => {
    expect(customerErrorKey("weird", 500)).toBe("generic");
    expect(customerErrorKey(undefined)).toBe("generic");
  });
});
