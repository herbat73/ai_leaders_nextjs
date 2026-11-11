import { describe, expect, it } from "vitest";

import { ClamdScanner } from "./clamd-scanner";

/**
 * Against a real clamd (`docker compose up -d --wait clamav`); skipped unless `CLAMD_LIVE=1`, because the gate has no
 * scanner. The standard EICAR string is the harmless test file every scanner flags. It is not an image, so through the
 * upload route it is refused earlier (400 `not_an_image`): this test is the one that proves the adapter really gets
 * "infected" from a real scanner, which the stub in `clamd-scanner.test.ts` cannot.
 */
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

describe.skipIf(process.env.CLAMD_LIVE !== "1")("ClamdScanner against a real clamd", () => {
  const scanner = new ClamdScanner({ host: process.env.EASYRMS_CLAMAV_HOST ?? "127.0.0.1", port: Number(process.env.EASYRMS_CLAMAV_PORT ?? 3310), timeoutMs: 20_000 });

  it("flags the EICAR test string as infected", async () => {
    expect(await scanner.scan(new TextEncoder().encode(EICAR))).toEqual({ status: "infected" });
  });

  it("answers clean for an ordinary file", async () => {
    expect(await scanner.scan(new TextEncoder().encode("just some text, nothing to see"))).toEqual({ status: "clean" });
  });

  it("scans a few megabytes in chunks", async () => {
    expect(await scanner.scan(new Uint8Array(3 * 1024 * 1024).fill(65))).toEqual({ status: "clean" });
  });
});
