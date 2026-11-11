import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { ClamdScanner, interpret } from "./clamd-scanner";

/** A stub clamd: reads the INSTREAM framing and answers with whatever the test chose. */
interface Stub {
  server: Server;
  port: number;
  received: { command: string; chunks: number[]; terminated: boolean }[];
}

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function stub(onComplete: (socket: Socket) => void, options: { answerEarly?: boolean } = {}): Promise<Stub> {
  const received: Stub["received"] = [];
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    const state = { command: "", chunks: [] as number[], terminated: false };
    received.push(state);
    socket.on("error", () => undefined);
    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);
      if (!state.command) {
        const nul = buffer.indexOf(0);
        if (nul < 0) return;
        state.command = buffer.subarray(0, nul).toString();
        buffer = buffer.subarray(nul + 1);
      }
      for (;;) {
        if (buffer.length < 4) return;
        const length = buffer.readUInt32BE(0);
        if (length === 0) {
          state.terminated = true;
          return onComplete(socket);
        }
        if (buffer.length < 4 + length) return;
        state.chunks.push(length);
        buffer = buffer.subarray(4 + length);
      }
    });
    if (options.answerEarly) onComplete(socket);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: (server.address() as AddressInfo).port, received };
}

const scanner = (port: number, timeoutMs = 2000) => new ClamdScanner({ host: "127.0.0.1", port, timeoutMs });
const bytes = (n: number) => new Uint8Array(n).fill(1);

describe("ClamdScanner against a stub clamd", () => {
  it("sends zINSTREAM, length-prefixed chunks and a zero terminator, and reads OK as clean", async () => {
    const ctx = await stub((socket) => socket.end("stream: OK\0"));
    expect(await scanner(ctx.port).scan(bytes(150_000))).toEqual({ status: "clean" });
    expect(ctx.received[0]).toEqual({ command: "zINSTREAM", chunks: [65536, 65536, 150_000 - 2 * 65536], terminated: true });
  });

  it("reads a FOUND answer as infected", async () => {
    const ctx = await stub((socket) => socket.end("stream: Win.Test.EICAR_HDB-1 FOUND\0"));
    expect(await scanner(ctx.port).scan(bytes(10))).toEqual({ status: "infected" });
  });

  it("scans an empty body with just the terminator", async () => {
    const ctx = await stub((socket) => socket.end("stream: OK\0"));
    expect(await scanner(ctx.port).scan(new Uint8Array(0))).toEqual({ status: "clean" });
    expect(ctx.received[0]?.chunks).toEqual([]);
  });

  it("fails closed on an ERROR answer (for example clamd's size limit)", async () => {
    const ctx = await stub((socket) => socket.end("INSTREAM size limit exceeded. ERROR\0"));
    expect(await scanner(ctx.port).scan(bytes(10))).toEqual({ status: "unavailable" });
  });

  it("fails closed when the socket closes without an answer", async () => {
    const ctx = await stub((socket) => socket.destroy());
    expect(await scanner(ctx.port).scan(bytes(10))).toEqual({ status: "unavailable" });
  });

  it("fails closed when clamd never answers, at the timeout", async () => {
    const ctx = await stub(() => undefined);
    const started = Date.now();
    expect(await scanner(ctx.port, 200).scan(bytes(10))).toEqual({ status: "unavailable" });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("fails closed when nothing listens on the port", async () => {
    const ctx = await stub(() => undefined);
    const port = ctx.port;
    await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
    expect(await scanner(port).scan(bytes(10))).toEqual({ status: "unavailable" });
  });

  it("does not treat a lookalike answer as clean", async () => {
    for (const answer of ["stream: OK and more FOUND\0".replace(" FOUND", ""), "OK\0", "stream: OKAY\0", "\0"]) {
      const ctx = await stub((socket) => socket.end(answer));
      expect(await scanner(ctx.port).scan(bytes(10)), answer).toEqual({ status: "unavailable" });
    }
  });
});

describe("interpret", () => {
  it.each([
    ["stream: OK\0", "clean"],
    ["stream: OK", "clean"],
    ["stream: Eicar-Signature FOUND\0", "infected"],
    ["stream: ERROR\0", "unavailable"],
    ["", "unavailable"],
    ["stream: OK\nstream: Eicar FOUND", "unavailable"],
  ])("%j is %s", (raw, status) => {
    expect(interpret(raw).status).toBe(status);
  });
});
