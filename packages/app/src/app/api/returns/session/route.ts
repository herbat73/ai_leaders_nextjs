import { apiHandler, okResponse } from "@easyrms/core";

import { serializeClearedSessionCookie } from "@/server/guest-session";
import { httpOptions } from "@/server/http-options";

export const dynamic = "force-dynamic";

/** Ends the guest session ("Wyloguj"). Idempotent: with no cookie it still answers 200. CSRF-checked by `apiHandler`. */
export const DELETE = apiHandler(async () => {
  return okResponse({}, { headers: { "set-cookie": serializeClearedSessionCookie(), "cache-control": "no-store" } });
}, httpOptions);
