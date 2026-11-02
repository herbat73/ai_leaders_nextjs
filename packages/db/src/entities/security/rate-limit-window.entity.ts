import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

/** One fixed window of the shared throttle store; written only through `PostgresRateLimiter` (atomic upserts). */
export const RateLimitWindowSchema = defineEntity({
  name: "RateLimitWindow",
  tableName: "rate_limit_windows",
  properties: {
    // `login:<ip>`, `failed:<email>:<ip>`, ... : may contain an e-mail address, so never logged.
    key: p.string().length(320).primary(),
    count: p.integer(),
    endsAt: p.datetime(),
  },
});

export type RateLimitWindowEntity = InferEntity<typeof RateLimitWindowSchema>;
