import { NextResponse, type NextRequest } from "next/server";
import { isAgentProtectedPath, isApiPath, sanitizeAdminNext } from "@easyrms/core";

import { AGENT_SESSION_COOKIE, getAgentSessionService } from "@/server/agent-session";

/**
 * Optimistic first line of defense for the back office: a request without a validly signed, unexpired agent token
 * never reaches a page or an API route. It deliberately does not touch the database (this runs on every request); the
 * pages and routes still call `requireAgentPage` / `requireAgent`, which load the agent and compare the session epoch,
 * so disabling an agent takes effect on their next request.
 *
 * Next.js 16 calls this file `proxy` (it was `middleware`); it runs on the Node.js runtime.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (!isAgentProtectedPath(pathname)) return NextResponse.next();

  try {
    const token = request.cookies.get(AGENT_SESSION_COOKIE)?.value;
    // Resolved lazily here, never at import, so `next build` needs no secret and a missing one fails closed below.
    if (token && (await getAgentSessionService().verify(token))) return NextResponse.next();
  } catch (error) {
    // A configuration problem (missing secret in production) must not open the door: opaque 500, name only in the log.
    console.error("Agent proxy check failed", { name: error instanceof Error ? error.name : typeof error });
    return isApiPath(pathname)
      ? NextResponse.json({ ok: false, error: { code: "internal_error", message: "Internal server error" } }, { status: 500 })
      : new NextResponse("Internal server error", { status: 500 });
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", sanitizeAdminNext(`${pathname}${search}`));
  return NextResponse.redirect(login);
}

export const config = {
  // Constants only (Next analyses them at build time). The exact public/protected split lives in `isAgentProtectedPath`.
  matcher: ["/admin/:path*", "/api/agents/:path*", "/api/discovery/:path*", "/api/returns/:id"],
};
