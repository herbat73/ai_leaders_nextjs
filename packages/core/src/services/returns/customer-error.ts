/** Stable, language-neutral keys for what a customer page can tell the customer about a failed API call. */
export type CustomerErrorKey =
  | "not_found"
  | "rate_limited"
  | "service_unavailable"
  | "csrf_rejected"
  | "network_error"
  | "unexpected_response"
  | "unauthorized"
  | "validation_error"
  | "generic";

const KEYS: ReadonlySet<string> = new Set<CustomerErrorKey>([
  "not_found",
  "rate_limited",
  "service_unavailable",
  "csrf_rejected",
  "network_error",
  "unexpected_response",
  "unauthorized",
  "validation_error",
]);

/**
 * Maps an API `error.code` (and HTTP status, as a fallback for an unknown code) to a customer-facing key. A 404 is
 * always the one neutral lookup answer; anything unrecognised becomes `generic`. Pages map keys to copy (N3).
 */
export function customerErrorKey(code: string | undefined, status?: number): CustomerErrorKey {
  if (code && KEYS.has(code)) return code as CustomerErrorKey;
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  if (status === 401) return "unauthorized";
  return "generic";
}
