import { ConfigurationError } from "../../errors";

export type OrderSourceName = "fake";

/**
 * Chooses the order source from `EASYRMS_ORDER_SOURCE` (read by the caller; `core` never reads the environment).
 * Development defaults to `fake`. In production the value is required and `fake` always fails closed, with no override.
 */
export function selectOrderSource(input: { nodeEnv: string | undefined; source: string | undefined }): OrderSourceName {
  const production = input.nodeEnv === "production";
  const source = input.source?.trim().toLowerCase();
  if (!source) {
    if (production) throw new ConfigurationError("EASYRMS_ORDER_SOURCE must be set in production");
    return "fake";
  }
  if (source === "fake") {
    if (production) throw new ConfigurationError("EASYRMS_ORDER_SOURCE=fake is not allowed in production");
    return "fake";
  }
  throw new ConfigurationError(`Unknown EASYRMS_ORDER_SOURCE '${input.source}'`);
}
