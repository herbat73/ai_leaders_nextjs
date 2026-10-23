import {
  GUEST_SESSION_TTL_SECONDS,
  GuestSessionService,
  readCookie,
  resolveGuestSessionSecret,
  serializeClearedCookie,
  serializeCookie,
} from "@easyrms/core";
import { randomBytes } from "node:crypto";

export const GUEST_SESSION_COOKIE = "easyrms_guest";

const secure = (): boolean => process.env.NODE_ENV === "production";

export function serializeSessionCookie(token: string, options: { secure: boolean } = { secure: secure() }): string {
  return serializeCookie(GUEST_SESSION_COOKIE, token, GUEST_SESSION_TTL_SECONDS, options);
}

export function serializeClearedSessionCookie(options: { secure: boolean } = { secure: secure() }): string {
  return serializeClearedCookie(GUEST_SESSION_COOKIE, options);
}

/** Token from a `Cookie` header (`request.headers.get("cookie")`), or `null`. */
export function readSessionToken(cookieHeader: string | null | undefined): string | null {
  return readCookie(cookieHeader, GUEST_SESSION_COOKIE);
}

// Shared across route bundles and HMR so every bundle signs with the same dev secret and warns once.
const globalForSession = globalThis as unknown as {
  __easyrmsGuestSessionSecret?: string;
  __easyrmsGuestSession?: GuestSessionService;
};

/**
 * Memoized service built from `EASYRMS_GUEST_SESSION_SECRET` and `NODE_ENV`. Resolved lazily, never at import, so
 * `next build` is unaffected and production fails closed (opaque 500) on the first session request.
 */
export function getGuestSessionService(): GuestSessionService {
  globalForSession.__easyrmsGuestSession ??= new GuestSessionService({
    secret: resolveGuestSessionSecret({
      nodeEnv: process.env.NODE_ENV,
      secret: process.env.EASYRMS_GUEST_SESSION_SECRET,
      devSecretProvider: () => (globalForSession.__easyrmsGuestSessionSecret ??= randomBytes(32).toString("hex")),
      warn: (message) => console.warn(message),
    }),
    ttlSeconds: GUEST_SESSION_TTL_SECONDS,
    clock: () => new Date(),
  });
  return globalForSession.__easyrmsGuestSession;
}
