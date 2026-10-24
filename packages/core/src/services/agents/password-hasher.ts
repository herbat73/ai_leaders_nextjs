import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Port for password hashing; the production adapter is `ScryptPasswordHasher`. */
export interface PasswordHasher {
  /** Returns a self-describing hash (parameters and salt included). */
  hash(password: string): Promise<string>;
  /** Constant-time comparison; false (never throws) for a malformed stored hash. */
  verify(password: string, stored: string): Promise<boolean>;
  /** True when the stored hash was made with weaker parameters than the hasher's current ones. */
  needsRehash(stored: string): boolean;
}

export interface ScryptParams {
  /** CPU/memory cost (power of two). */
  N: number;
  r: number;
  p: number;
}

/** OWASP-acceptable scrypt parameters: about 64 MiB per hash. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 16, r: 8, p: 2 };

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORMAT = "scrypt";

interface ParsedHash extends ScryptParams {
  salt: Buffer;
  hash: Buffer;
}

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    // Node rejects N*r*128 above the default 32 MiB unless maxmem is raised.
    maxmem: 128 * params.N * params.r * 2,
  };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** `scrypt$N$r$p$salt$hash` (salt and hash base64), or `null` when the string is not in that format. */
export function parsePasswordHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== FORMAT) return null;
  const [N, r, p] = [parts[1], parts[2], parts[3]].map((value) => (/^\d{1,9}$/.test(value) ? Number(value) : NaN));
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return null;
  if (N < 2 || (N & (N - 1)) !== 0) return null;
  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || hash.length === 0) return null;
  return { N, r, p, salt, hash };
}

export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly params: ScryptParams = DEFAULT_SCRYPT_PARAMS) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt, this.params);
    const { N, r, p } = this.params;
    return [FORMAT, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = parsePasswordHash(stored);
    if (!parsed) return false;
    try {
      // Parameters come from the stored hash, so they can be raised later without a migration.
      const key = await deriveKey(password, parsed.salt, parsed);
      return key.length === parsed.hash.length && timingSafeEqual(key, parsed.hash);
    } catch {
      return false;
    }
  }

  needsRehash(stored: string): boolean {
    const parsed = parsePasswordHash(stored);
    if (!parsed) return true;
    return parsed.N < this.params.N || parsed.r < this.params.r || parsed.p < this.params.p;
  }
}
