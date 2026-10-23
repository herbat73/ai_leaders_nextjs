import { describe, expect, it } from "vitest";
import { SHARED_IP_BUCKET, clientIp } from "./client-ip";

const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("clientIp", () => {
  it("ignores x-forwarded-for when proxy is not trusted", () => {
    expect(clientIp(h("9.9.9.9"), { trustProxy: false })).toBe(SHARED_IP_BUCKET);
    expect(clientIp(h("1.2.3.4, 5.6.7.8"), { trustProxy: false })).toBe(SHARED_IP_BUCKET);
    expect(clientIp(h(), { trustProxy: false })).toBe(SHARED_IP_BUCKET);
  });

  it("uses the first entry, trimmed, when trusted", () => {
    expect(clientIp(h("  203.0.113.7 , 10.0.0.1"), { trustProxy: true })).toBe("203.0.113.7");
    expect(clientIp(h("2001:db8::1"), { trustProxy: true })).toBe("2001:db8::1");
  });

  it("falls back to the shared bucket for missing, empty or garbled values", () => {
    for (const v of [undefined, "", " ", ",1.2.3.4", "unknown", "1.2.3.999", "<script>", "1.2.3.4:80", "a".repeat(500)]) {
      expect(clientIp(h(v), { trustProxy: true })).toBe(SHARED_IP_BUCKET);
    }
  });
});
