import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PayloadTooLargeError, ValidationError } from "../errors";
import { parseJsonBody } from "./parse";

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
