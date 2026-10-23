import { isIP } from "node:net";

export const SHARED_IP_BUCKET = "shared";

export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Client address for rate-limit keys. Only with `trustProxy` is the first `x-forwarded-for`
 * entry used (when it is a valid IP); otherwise, or for anything garbled, one shared bucket,
 * so a spoofed header cannot mint fresh buckets.
 */
export function clientIp(headers: HeaderReader, { trustProxy }: { trustProxy: boolean }): string {
  if (!trustProxy) return SHARED_IP_BUCKET;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!first || isIP(first) === 0) return SHARED_IP_BUCKET;
  return first.toLowerCase();
}
