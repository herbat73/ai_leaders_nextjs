import { AppError } from "../../errors";
import type { PasswordHasher } from "./password-hasher";

export const DEFAULT_MAX_CONCURRENT_HASHES = 4;

/** Too many password hashes in flight: answered without hashing, so memory stays bounded (about 64 MiB each). */
export class BusyError extends AppError {
  constructor(message = "The server is busy, try again shortly") {
    super(message, 503, "busy");
  }
}

/**
 * Caps the number of concurrent `hash`/`verify` calls of one process. Beyond the cap the call fails fast with
 * `BusyError` (503 `busy`) instead of queueing, because a queue of 64 MiB jobs is exactly the memory spike to avoid.
 */
export function limitHashConcurrency(hasher: PasswordHasher, max = DEFAULT_MAX_CONCURRENT_HASHES): PasswordHasher {
  if (!Number.isInteger(max) || max < 1) throw new Error("max must be a positive integer");
  let inFlight = 0;
  const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
    if (inFlight >= max) throw new BusyError();
    inFlight += 1;
    try {
      return await run();
    } finally {
      inFlight -= 1;
    }
  };
  return {
    hash: (password) => guarded(() => hasher.hash(password)),
    verify: (password, stored) => guarded(() => hasher.verify(password, stored)),
    needsRehash: (stored) => hasher.needsRehash(stored),
  };
}
