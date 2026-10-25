/**
 * Which request paths need an agent session. Used by `proxy.ts` as the optimistic first line of defense; the routes and
 * pages still run their own authoritative check against the database. Kept here, pure and tested, because a mistake in
 * these lists is a fail-open hole.
 *
 * Protected: every `/admin/**` page except the login page and the invite page (one token segment), `/api/agents/**`
 * except login and invite acceptance, `/api/discovery/**`, `/api/suppliers/**`, `/api/supplier-claims/**`, and `/api/returns/<digits>` (the agent decision route). The
 * customer routes (`/api/returns`, `lookup`, `quote`, `session`) stay public.
 */
export function isAgentProtectedPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return false;
    if (/^\/admin\/invite\/[^/]+$/.test(pathname)) return false;
    return true;
  }
  if (pathname === "/api/agents" || pathname.startsWith("/api/agents/")) {
    return pathname !== "/api/agents/login" && pathname !== "/api/agents/invite/accept";
  }
  if (pathname === "/api/discovery" || pathname.startsWith("/api/discovery/")) return true;
  if (pathname === "/api/suppliers" || pathname.startsWith("/api/suppliers/")) return true;
  if (pathname === "/api/supplier-claims" || pathname.startsWith("/api/supplier-claims/")) return true;
  return /^\/api\/returns\/\d+$/.test(pathname);
}

/** Paths answered with a JSON envelope (401) rather than a redirect to the login page. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
