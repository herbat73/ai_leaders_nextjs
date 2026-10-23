import { SignJWT, jwtVerify } from "jose";
import { ConfigurationError } from "../../errors";

export const GUEST_SESSION_TTL_SECONDS = 7200;
export const GUEST_SESSION_MIN_SECRET_BYTES = 32;

const ORDER_CLAIM = "order";

export interface GuestSessionConfig {
  /** Already resolved with `resolveGuestSessionSecret`; `null` means sessions cannot be issued or verified. */
  secret: string | null;
  ttlSeconds: number;
  clock: () => Date;
}

/**
 * Stateless guest session: an HS256 JWT whose only claim is the canonical order number the customer proved
 * ownership of. `verify` never throws on bad input.
 */
export class GuestSessionService {
  private readonly key: Uint8Array | null;

  constructor(private readonly config: GuestSessionConfig) {
    this.key = config.secret === null ? null : new TextEncoder().encode(config.secret);
  }

  async issue(canonicalOrderNumber: string): Promise<string> {
    if (!this.key) throw new ConfigurationError("Guest session secret is not configured");
    const now = Math.floor(this.config.clock().getTime() / 1000);
    return new SignJWT({ [ORDER_CLAIM]: canonicalOrderNumber })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + this.config.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string | null | undefined): Promise<{ orderNumber: string } | null> {
    if (!this.key || !token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        currentDate: this.config.clock(),
      });
      const order = payload[ORDER_CLAIM];
      return typeof order === "string" && order !== "" ? { orderNumber: order } : null;
    } catch {
      return null;
    }
  }

  /** True when the token is valid and was issued for exactly this canonical order number. */
  async assertOrder(token: string | null | undefined, canonicalOrderNumber: string): Promise<boolean> {
    const session = await this.verify(token);
    return session !== null && session.orderNumber === canonicalOrderNumber;
  }
}

/**
 * Chooses the signing secret (inputs read by the caller; `core` never reads the environment). At least 32 bytes are
 * required. Outside `development` a missing or short secret fails closed. In development a missing secret becomes
 * an ephemeral one from `devSecretProvider` with a single warning; a short explicit secret still throws.
 */
export function resolveGuestSessionSecret(input: {
  nodeEnv: string | undefined;
  secret: string | undefined;
  devSecretProvider: () => string;
  warn: (message: string) => void;
}): string {
  const secret = input.secret?.trim();
  if (secret) {
    if (new TextEncoder().encode(secret).length < GUEST_SESSION_MIN_SECRET_BYTES) {
      throw new ConfigurationError(`EASYRMS_GUEST_SESSION_SECRET must be at least ${GUEST_SESSION_MIN_SECRET_BYTES} bytes`);
    }
    return secret;
  }
  if (input.nodeEnv !== "development") {
    throw new ConfigurationError("EASYRMS_GUEST_SESSION_SECRET must be set outside development");
  }
  input.warn(
    "EASYRMS_GUEST_SESSION_SECRET is not set: using an ephemeral per-process secret; guest sessions end when the dev server restarts",
  );
  return input.devSecretProvider();
}
