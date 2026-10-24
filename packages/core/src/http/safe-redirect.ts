const BASE = "http://redirect-check.invalid";

/**
 * A post-login destination from user-controlled input (`?next=`): only a same-site path inside `/admin` survives
 * (`/admin`, `/admin/...`, with an optional query), anything else becomes `fallback`. Rejects absolute and
 * protocol-relative URLs, backslashes, control characters and dot segments (even percent-encoded) that would resolve
 * outside `/admin`, so the login page is never an open redirect.
 */
export function sanitizeAdminNext(value: string | string[] | null | undefined, fallback = "/admin/returns"): string {
  if (typeof value !== "string" || value === "") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (parsed.origin !== BASE) return fallback;
  const inAdmin = parsed.pathname === "/admin" || parsed.pathname.startsWith("/admin/");
  // `URL` resolves dot segments, so a path that escaped `/admin` is caught above; one that still contains them did
  // not move and is refused as well, to keep what the browser navigates to identical to what was checked.
  const hasDots = parsed.pathname.split("/").some((segment) => segment === "." || segment === "..");
  if (!inAdmin || hasDots || parsed.pathname !== value.split(/[?#]/)[0]) return fallback;
  return `${parsed.pathname}${parsed.search}`;
}
