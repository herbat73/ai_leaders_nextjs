import { describe, expect, it } from "vitest";
import { readCookie, serializeClearedCookie, serializeCookie } from "./cookies";

describe("serializeCookie", () => {
  it("sets HttpOnly, SameSite=Lax, Path=/ and Max-Age", () => {
    const cookie = serializeCookie("easyrms_guest", "tok", 7200, { secure: false });
    expect(cookie).toBe("easyrms_guest=tok; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200");
  });

  it("adds Secure only when requested", () => {
    expect(serializeCookie("a", "b", 7200, { secure: true })).toContain("; Secure");
    expect(serializeCookie("a", "b", 7200, { secure: false })).not.toContain("Secure");
  });

  it("clears with an empty value and Max-Age=0", () => {
    const cookie = serializeClearedCookie("a", { secure: true });
    expect(cookie).toBe("a=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure");
  });
});

describe("readCookie", () => {
  it("finds the named cookie among several", () => {
    expect(readCookie("x=1; easyrms_guest=abc.def.ghi; y=2", "easyrms_guest")).toBe("abc.def.ghi");
  });

  it("keeps '=' inside the value", () => {
    expect(readCookie("a=b=c", "a")).toBe("b=c");
  });

  it("returns null when absent, empty or malformed", () => {
    expect(readCookie(null, "a")).toBeNull();
    expect(readCookie(undefined, "a")).toBeNull();
    expect(readCookie("", "a")).toBeNull();
    expect(readCookie("a=", "a")).toBeNull();
    expect(readCookie("novalue; b=1", "a")).toBeNull();
    expect(readCookie("xa=1", "a")).toBeNull();
  });
});
