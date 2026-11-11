import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PayloadTooLargeError, ValidationError } from "../errors";
import { parseJsonBody, readCappedBytes } from "./parse";

const schema = z.object({ csv: z.string() });
const post = (body: BodyInit, headers: HeadersInit = {}): Request =>
  new Request("http://localhost/api", { method: "POST", body, headers });

describe("parseJsonBody", () => {
  it("behaves as before without maxBytes", async () => {
    await expect(parseJsonBody(post(JSON.stringify({ csv: "x".repeat(5000) })), schema)).resolves.toEqual({
      csv: "x".repeat(5000),
    });
    await expect(parseJsonBody(post("nope"), schema)).rejects.toThrow(ValidationError);
    await expect(parseJsonBody(post("[1]"), schema)).rejects.toThrow(ValidationError);
  });

  it("accepts a body within maxBytes and rejects invalid JSON with a 400", async () => {
    await expect(parseJsonBody(post('{"csv":"a"}'), schema, { maxBytes: 100 })).resolves.toEqual({ csv: "a" });
    await expect(parseJsonBody(post("nope"), schema, { maxBytes: 100 })).rejects.toThrow(ValidationError);
  });

  it("rejects an oversized body from Content-Length", async () => {
    const request = post('{"csv":"a"}', { "content-length": "101" });
    await expect(parseJsonBody(request, schema, { maxBytes: 100 })).rejects.toThrow(PayloadTooLargeError);
  });

  it("rejects an oversized body without Content-Length by capping the stream read", async () => {
    const chunks = [new TextEncoder().encode('{"csv":"'), new TextEncoder().encode("x".repeat(200)), new TextEncoder().encode('"}')];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request("http://localhost/api", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    const error = await parseJsonBody(request, schema, { maxBytes: 100, tooLargeMessage: "Za duży" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error).toMatchObject({ status: 413, code: "payload_too_large", message: "Za duży" });
  });
});

describe("readCappedBytes", () => {
  const streamPost = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request("http://x/upload", { method: "POST", body, headers });

  it("returns the bytes up to the cap", async () => {
    const bytes = await readCappedBytes(streamPost(new Uint8Array([1, 2, 3])), 3);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("returns an empty array for no body", async () => {
    expect((await readCappedBytes(streamPost(null), 10)).byteLength).toBe(0);
  });

  it("refuses from the declared length without reading", async () => {
    await expect(readCappedBytes(streamPost("x", { "content-length": "999" }), 10)).rejects.toMatchObject({ status: 413 });
  });

  it("stops reading a streamed body that grows past the cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(4));
        if (pulled > 100) controller.close();
      },
    });
    const request = new Request("http://x/upload", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readCappedBytes(request, 10)).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
    expect(pulled).toBeLessThan(10);
  });
});
