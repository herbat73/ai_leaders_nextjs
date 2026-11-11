import { describe, expect, it } from "vitest";

import { parseEvidenceLimits, parseScannerConfig } from "./config";
import { DEFAULT_EVIDENCE_LIMITS } from "./types";

describe("parseEvidenceLimits", () => {
  it("keeps the numbers of Q4 when nothing is set", () => {
    expect(parseEvidenceLimits({})).toEqual(DEFAULT_EVIDENCE_LIMITS);
    expect(parseEvidenceLimits({ maxFileMb: " ", maxFiles: null })).toEqual(DEFAULT_EVIDENCE_LIMITS);
    expect(DEFAULT_EVIDENCE_LIMITS).toMatchObject({ maxFileBytes: 5 * 1024 * 1024, maxFilesPerRequest: 6, maxBytesPerOrder: 20 * 1024 * 1024 });
  });

  it("takes whole numbers in range", () => {
    expect(parseEvidenceLimits({ maxFileMb: "2", maxFiles: "3", maxOrderMb: "10" })).toMatchObject({
      maxFileBytes: 2 * 1024 * 1024,
      maxFilesPerRequest: 3,
      maxBytesPerOrder: 10 * 1024 * 1024,
    });
  });

  it.each([["0"], ["-1"], ["abc"], ["1.5"], ["26"]])("refuses a file size of %s", (maxFileMb) => {
    expect(() => parseEvidenceLimits({ maxFileMb })).toThrow(/EASYRMS_EVIDENCE_MAX_FILE_MB/);
  });

  it("refuses a file size above the order quota", () => {
    expect(() => parseEvidenceLimits({ maxFileMb: "10", maxOrderMb: "5" })).toThrow(/cannot exceed/);
  });
});

describe("parseScannerConfig", () => {
  it("defaults to localhost:3310 outside production", () => {
    expect(parseScannerConfig({})).toEqual({ host: "localhost", port: 3310, timeoutMs: 10_000 });
    expect(parseScannerConfig({ nodeEnv: "development" }).host).toBe("localhost");
  });

  it("requires the host in production", () => {
    expect(() => parseScannerConfig({ nodeEnv: "production" })).toThrow(/EASYRMS_CLAMAV_HOST is required/);
    expect(parseScannerConfig({ nodeEnv: "production", host: "clamav", port: "3311", timeoutMs: "500" })).toEqual({ host: "clamav", port: 3311, timeoutMs: 500 });
  });

  it.each([["clam av"], ["http://clamav"], ["a/b"]])("refuses the host %j", (host) => {
    expect(() => parseScannerConfig({ host })).toThrow(/host name/);
  });

  it.each([["0"], ["70000"], ["x"]])("refuses the port %s", (port) => {
    expect(() => parseScannerConfig({ port })).toThrow(/EASYRMS_CLAMAV_PORT/);
  });
});
