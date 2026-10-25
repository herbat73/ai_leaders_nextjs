import {
  AGENT_SESSION_TTL_SECONDS,
  AgentSessionService,
  readCookie,
  resolveAgentSessionSecret,
  serializeClearedCookie,
  serializeCookie,
} from "@easyrms/core";
import { randomBytes } from "node:crypto";

export const AGENT_SESSION_COOKIE = "easyrms_agent";

const secure = (): boolean => process.env.NODE_ENV === "production";

export function serializeAgentSessionCookie(token: string, options: { secure: boolean } = { secure: secure() }): string {
  return serializeCookie(AGENT_SESSION_COOKIE, token, AGENT_SESSION_TTL_SECONDS, options);
}

export function serializeClearedAgentSessionCookie(options: { secure: boolean } = { secure: secure() }): string {
  return serializeClearedCookie(AGENT_SESSION_COOKIE, options);
}

/** Token from a `Cookie` header (`request.headers.get("cookie")`), or `null`. */
export function readAgentSessionToken(cookieHeader: string | null | undefined): string | null {
  return readCookie(cookieHeader, AGENT_SESSION_COOKIE);
}

// Shared across route bundles and HMR so every bundle signs with the same dev secret and warns once.
const globalForSession = globalThis as unknown as {
  __easyrmsAgentSessionSecret?: string;
  __easyrmsAgentSession?: AgentSessionService;
};

/**
 * Memoized service built from `EASYRMS_AGENT_SESSION_SECRET` and `NODE_ENV`. Resolved lazily, never at import, so
 * `next build` is unaffected and production fails closed (opaque 500) on the first login or invite acceptance.
 */
export function getAgentSessionService(): AgentSessionService {
  globalForSession.__easyrmsAgentSession ??= new AgentSessionService({
    secret: resolveAgentSessionSecret({
      nodeEnv: process.env.NODE_ENV,
      secret: process.env.EASYRMS_AGENT_SESSION_SECRET,
      devSecretProvider: () => (globalForSession.__easyrmsAgentSessionSecret ??= randomBytes(32).toString("hex")),
      warn: (message) => console.warn(message),
    }),
    ttlSeconds: AGENT_SESSION_TTL_SECONDS,
    clock: () => new Date(),
  });
  return globalForSession.__easyrmsAgentSession;
}
