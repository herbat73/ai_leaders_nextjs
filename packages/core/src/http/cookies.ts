export interface CookieOptions {
  /** Add the `Secure` attribute (production only; browsers drop Secure cookies on plain http). */
  secure: boolean;
}

/**
 * Session cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`. `maxAgeSeconds` 0 clears it.
 * The value is expected to be a token (JWT) that needs no escaping.
 */
export function serializeCookie(name: string, value: string, maxAgeSeconds: number, { secure }: CookieOptions): string {
  const parts = [`${name}=${value}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearedCookie(name: string, options: CookieOptions): string {
  return serializeCookie(name, "", 0, options);
}

/** Reads one cookie from a `Cookie` request header; `null` when absent or empty. Never throws. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    if (pair.slice(0, eq).trim() !== name) continue;
    const value = pair.slice(eq + 1).trim();
    return value === "" ? null : value;
  }
  return null;
}
