import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher, parsePasswordHash } from "./password-hasher";

// Cheap parameters keep the suite fast; the default (64 MiB) is covered by one test below.
const fast = { N: 2 ** 4, r: 8, p: 1 };

describe("ScryptPasswordHasher", () => {
  const hasher = new ScryptPasswordHasher(fast);

  it("round-trips and rejects a wrong password", async () => {
    const stored = await hasher.hash("correct horse battery");
    expect(await hasher.verify("correct horse battery", stored)).toBe(true);
    expect(await hasher.verify("correct horse batterz", stored)).toBe(false);
  });

  it("uses a fresh salt each time", async () => {
    expect(await hasher.hash("same password 123")).not.toBe(await hasher.hash("same password 123"));
  });

  it("stores a self-describing format", async () => {
    const stored = await hasher.hash("some password 123");
    expect(stored).toMatch(/^scrypt\$16\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    const parsed = parsePasswordHash(stored);
    expect(parsed).toMatchObject({ N: 16, r: 8, p: 1 });
  });

  it("rejects a tampered hash", async () => {
    const stored = await hasher.hash("some password 123");
    const parts = stored.split("$");
    const tampered = Buffer.from(parts[5], "base64");
    tampered[0] ^= 0xff;
    parts[5] = tampered.toString("base64");
    expect(await hasher.verify("some password 123", parts.join("$"))).toBe(false);
  });

  it.each(["", "plain", "scrypt$16$8$1$abc", "bcrypt$16$8$1$YQ==$YQ==", "scrypt$15$8$1$YQ==$YQ==", "scrypt$x$8$1$YQ==$YQ==", "scrypt$16$8$1$$YQ=="])(
    "treats malformed hash %j as a mismatch without throwing",
    async (stored) => {
      expect(parsePasswordHash(stored)).toBeNull();
      expect(await hasher.verify("whatever", stored)).toBe(false);
    },
  );

  it("reads the parameters from the stored hash, not from the verifier", async () => {
    const stored = await new ScryptPasswordHasher({ N: 2 ** 5, r: 8, p: 1 }).hash("password 123456");
    expect(await hasher.verify("password 123456", stored)).toBe(true);
  });

  it("flags weaker or malformed hashes for rehash", async () => {
    const strong = new ScryptPasswordHasher({ N: 2 ** 6, r: 8, p: 1 });
    expect(strong.needsRehash(await hasher.hash("password 123456"))).toBe(true);
    expect(strong.needsRehash(await strong.hash("password 123456"))).toBe(false);
    expect(strong.needsRehash("garbage")).toBe(true);
  });

  it("works with the production parameters", async () => {
    const production = new ScryptPasswordHasher();
    const stored = await production.hash("production password");
    expect(stored.startsWith("scrypt$65536$8$2$")).toBe(true);
    expect(await production.verify("production password", stored)).toBe(true);
    expect(production.needsRehash(stored)).toBe(false);
  });
});
