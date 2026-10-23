import { parseTrustProxy } from "@easyrms/core";

let trustProxy: boolean | undefined;

/**
 * Shared options for every route's `apiHandler` / `makeCrudRoute`. `trustProxy` is a memoized function, never a value
 * computed at import: `next build` runs with `EASYRMS_TRUST_PROXY` unset, and in production the first mutating request
 * must be what fails closed. This is the only place the variable is parsed.
 */
export const httpOptions = {
  trustProxy: (): boolean => {
    trustProxy ??= parseTrustProxy({ nodeEnv: process.env.NODE_ENV, value: process.env.EASYRMS_TRUST_PROXY });
    return trustProxy;
  },
};
