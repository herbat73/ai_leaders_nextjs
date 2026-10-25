import { SignJWT, jwtVerify } from "jose";
import { ConfigurationError } from "../../errors";

export const AGENT_SESSION_TTL_SECONDS = 8 * 3600;
export const AGENT_SESSION_MIN_SECRET_BYTES = 32;
export const AGENT_SESSION_AUDIENCE = "agent";

const EPOCH_CLAIM = "ep";

export interface AgentSessionConfig {
  /** Already resolved with `resolveAgentSessionSecret`; `null` means sessions cannot be issued or verified. */
  secret: string | null;
  ttlSeconds: number;
  clock: () => Date;
}

export interface AgentSessionClaims {
  agentId: number;
  /** The agent's `session_epoch` when the token was issued; a different stored value revokes the token. */
  epoch: number;
}

/**
 * Stateless agent session: an HS256 JWT with `sub` (agent id), `ep` (session epoch) and `aud: "agent"`. It proves only
 * that we signed it; whether the agent is still active is checked against the database by the caller. `verify` never
 * throws on bad input. A guest token (different secret, no audience) never verifies here, nor the reverse.
 */
export class AgentSessionService {
  private readonly key: Uint8Array | null;

  constructor(private readonly config: AgentSessionConfig) {
    this.key = config.secret === null ? null : new TextEncoder().encode(config.secret);
  }

  async issue(claims: AgentSessionClaims): Promise<string> {
    if (!this.key) throw new ConfigurationError("Agent session secret is not configured");
    const now = Math.floor(this.config.clock().getTime() / 1000);
    return new SignJWT({ [EPOCH_CLAIM]: claims.epoch })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(claims.agentId))
      .setAudience(AGENT_SESSION_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + this.config.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string | null | undefined): Promise<AgentSessionClaims | null> {
    if (!this.key || !token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        audience: AGENT_SESSION_AUDIENCE,
        currentDate: this.config.clock(),
      });
      const agentId = typeof payload.sub === "string" && /^\d{1,9}$/.test(payload.sub) ? Number(payload.sub) : NaN;
      const epoch = payload[EPOCH_CLAIM];
      if (!Number.isInteger(agentId) || typeof epoch !== "number" || !Number.isInteger(epoch)) return null;
      return { agentId, epoch };
    } catch {
      return null;
    }
  }
}

/**
 * Chooses the agent signing secret (inputs read by the caller; `core` never reads the environment). At least 32 bytes
 * are required. Outside `development` a missing or short secret fails closed; in development a missing secret becomes
 * an ephemeral one from `devSecretProvider` with a single warning.
 */
export function resolveAgentSessionSecret(input: {
  nodeEnv: string | undefined;
  secret: string | undefined;
  devSecretProvider: () => string;
  warn: (message: string) => void;
}): string {
  const secret = input.secret?.trim();
  if (secret) {
    if (new TextEncoder().encode(secret).length < AGENT_SESSION_MIN_SECRET_BYTES) {
      throw new ConfigurationError(
        `EASYRMS_AGENT_SESSION_SECRET must be at least ${AGENT_SESSION_MIN_SECRET_BYTES} bytes`,
      );
    }
    return secret;
  }
  if (input.nodeEnv !== "development") {
    throw new ConfigurationError("EASYRMS_AGENT_SESSION_SECRET must be set outside development");
  }
  input.warn(
    "EASYRMS_AGENT_SESSION_SECRET is not set: using an ephemeral per-process secret; agent sessions end when the dev server restarts",
  );
  return input.devSecretProvider();
}
