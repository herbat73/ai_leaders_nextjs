import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const AgentSchema = defineEntity({
  name: "Agent",
  tableName: "agents",
  properties: {
    id: p.integer().primary(),
    // Stored trimmed and lower-cased; personal data, never logged.
    email: p.string().length(255).unique(),
    displayName: p.string().length(100),
    // `scrypt$N$r$p$salt$hash`; null until the invite is accepted.
    passwordHash: p.text().nullable(),
    permissions: p.array().columnType("text[]").defaultRaw("'{}'"),
    // `invited` | `active` | `disabled`, validated in code like the other statuses.
    status: p.string().length(16).default("invited"),
    sessionEpoch: p.integer().default(0),
    // SHA-256 hex of the one-time invite token; the token itself is never stored.
    inviteTokenHash: p.string().length(64).columnType("char(64)").nullable().unique(),
    inviteExpiresAt: p.datetime().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type AgentEntity = InferEntity<typeof AgentSchema>;
