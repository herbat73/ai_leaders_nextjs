import { ConfigurationError, ForbiddenError } from "../errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

/** The host the client addressed: `Host`, or the first `x-forwarded-host` entry only when the proxy is trusted. */
function requestHostOf(request: Request, trustProxy: boolean): string | undefined {
  const forwarded = trustProxy ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() : undefined;
  const host = forwarded || request.headers.get("host") || (URL.canParse(request.url) ? new URL(request.url).host : "");
  return host ? host.toLowerCase() : undefined;
}

/**
 * Pure CSRF check for a mutating request: the `x-requested-with` header must be present (a cross-site form or
 * simple request cannot set it) and, when `Origin` is sent, its host (with port) must equal the request host.
 * `Origin: null` and unparsable origins are rejected.
 */
export function isSameOriginRequest(request: Request, { trustProxy = false }: { trustProxy?: boolean } = {}): boolean {
  if (!request.headers.get("x-requested-with")) return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  if (!URL.canParse(origin)) return false;
  const requestHost = requestHostOf(request, trustProxy);
  return requestHost !== undefined && new URL(origin).host.toLowerCase() === requestHost;
}

/** Throws `ForbiddenError("csrf_rejected")` when `isSameOriginRequest` fails. */
export function assertSameOrigin(request: Request, options: { trustProxy?: boolean } = {}): void {
  if (!isSameOriginRequest(request, options)) throw new ForbiddenError("Cross-site request rejected");
}

/**
 * Parses `EASYRMS_TRUST_PROXY` (the caller passes the raw value; `core` never reads the environment). `true`/`false`
 * (case-insensitive) win; anything else is `false` outside production and a `ConfigurationError` in production.
 */
export function parseTrustProxy({ nodeEnv, value }: { nodeEnv: string | undefined; value: string | undefined }): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (nodeEnv === "production") {
    throw new ConfigurationError("EASYRMS_TRUST_PROXY must be set to 'true' or 'false' in production");
  }
  return false;
}
