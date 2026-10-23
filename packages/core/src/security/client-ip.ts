export const SHARED_IP_BUCKET = "shared";

export interface HeaderReader {
  get(name: string): string | null;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

function isIPv6(value: string): boolean {
  if (value.length > 45 || !/^[0-9a-f:.]+$/i.test(value)) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const parse = (part: string): string[] | null => (part === "" ? [] : part.split(":"));
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (!head || !tail) return false;
  const groups = [...head, ...tail];
  let width = 0;
  for (const [i, group] of groups.entries()) {
    if (i === groups.length - 1 && group.includes(".")) {
      if (!IPV4.test(group)) return false;
      width += 2;
    } else if (HEX_GROUP.test(group)) width += 1;
    else return false;
  }
  return halves.length === 2 ? width < 8 : width === 8;
}

/** Pure IPv4/IPv6 literal check (no `node:net`, so `core` stays platform-neutral). */
function isIpAddress(value: string): boolean {
  return IPV4.test(value) || isIPv6(value);
}

/**
 * Client address for rate-limit keys. Only with `trustProxy` is the first `x-forwarded-for`
 * entry used (when it is a valid IP); otherwise, or for anything garbled, one shared bucket,
 * so a spoofed header cannot mint fresh buckets.
 */
export function clientIp(headers: HeaderReader, { trustProxy }: { trustProxy: boolean }): string {
  if (!trustProxy) return SHARED_IP_BUCKET;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!first || !isIpAddress(first)) return SHARED_IP_BUCKET;
  return first.toLowerCase();
}
