import { connect, type Socket } from "node:net";
import type { MalwareScannerPort, ScanVerdict } from "@easyrms/core";

export interface ClamdOptions {
  host: string;
  port: number;
  /** Covers connect, upload and answer together; on expiry the verdict is `unavailable`. */
  timeoutMs: number;
}

const CHUNK_BYTES = 64 * 1024;

/**
 * clamd over TCP with the `INSTREAM` command: `zINSTREAM\0`, then chunks each prefixed with its length as a 4-byte
 * big-endian integer, closed by a zero-length chunk. The answer is `stream: OK`, `stream: <signature> FOUND` or an
 * error line, NUL-terminated.
 *
 * Fails closed: a refused connection, a timeout, a socket closed before an answer, an `ERROR` line (for example the
 * size limit of clamd) and any answer that is not exactly `OK` or `FOUND` give `unavailable`, never `clean`. Only an
 * exact `stream: OK` is clean.
 */
export class ClamdScanner implements MalwareScannerPort {
  constructor(private readonly options: ClamdOptions) {}

  scan(data: Uint8Array): Promise<ScanVerdict> {
    return new Promise<ScanVerdict>((resolve) => {
      let settled = false;
      let socket: Socket | undefined;
      const answer: Buffer[] = [];

      const finish = (verdict: ScanVerdict): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket?.destroy();
        resolve(verdict);
      };
      const timer = setTimeout(() => finish({ status: "unavailable" }), this.options.timeoutMs);

      try {
        socket = connect({ host: this.options.host, port: this.options.port });
      } catch {
        return finish({ status: "unavailable" });
      }
      socket.on("error", () => finish({ status: "unavailable" }));
      socket.on("close", () => finish(interpret(Buffer.concat(answer).toString("utf8"))));
      socket.on("data", (chunk: Buffer) => {
        answer.push(chunk);
        // The answer ends with a NUL (we asked for the `z` variant); do not wait for the close.
        if (chunk.includes(0)) finish(interpret(Buffer.concat(answer).toString("utf8")));
      });
      socket.on("connect", () => {
        const sock = socket as Socket;
        sock.write("zINSTREAM\0");
        for (let offset = 0; offset < data.byteLength; offset += CHUNK_BYTES) {
          const chunk = data.subarray(offset, Math.min(offset + CHUNK_BYTES, data.byteLength));
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.byteLength);
          sock.write(length);
          sock.write(chunk);
        }
        sock.write(Buffer.alloc(4));
      });
    });
  }
}

/** The verdict of a clamd answer; anything that is not exactly OK or FOUND is `unavailable`. */
export function interpret(raw: string): ScanVerdict {
  const line = raw.replace(/\0/g, "").trim();
  if (line === "stream: OK") return { status: "clean" };
  if (/^stream: .+ FOUND$/.test(line)) return { status: "infected" };
  return { status: "unavailable" };
}
