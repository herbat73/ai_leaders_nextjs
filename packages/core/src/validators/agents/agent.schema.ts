import { z } from "zod";
import { AGENT_PERMISSIONS, type AgentPermission } from "../../services/agents/types";

export const AGENT_PASSWORD_MIN_LENGTH = 12;
export const AGENT_PASSWORD_MAX_LENGTH = 128;

/** Trimmed and lower-cased, the stored form; the same function runs in the service and the repository. */
export function normalizeAgentEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailField = z
  .string()
  .trim()
  .max(254, "Email is too long")
  .pipe(z.email("A valid email is required"))
  .transform(normalizeAgentEmail);

export interface AgentLoginInput {
  email: string;
  password: string;
}

/** Format only; a wrong password must not be distinguishable from an unknown e-mail. */
export const agentLoginSchema: z.ZodType<AgentLoginInput, unknown> = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(AGENT_PASSWORD_MAX_LENGTH, "Password is too long"),
});

export interface AgentInviteAcceptInput {
  token: string;
  password: string;
}

export const agentInviteAcceptSchema: z.ZodType<AgentInviteAcceptInput, unknown> = z.object({
  token: z.string().trim().min(1, "Token is required").max(200, "Token is too long"),
  password: z
    .string()
    .min(AGENT_PASSWORD_MIN_LENGTH, `Password must be at least ${AGENT_PASSWORD_MIN_LENGTH} characters`)
    .max(AGENT_PASSWORD_MAX_LENGTH, `Password must be at most ${AGENT_PASSWORD_MAX_LENGTH} characters`),
});

export interface AgentInviteInput {
  email: string;
  displayName: string;
  permissions: AgentPermission[];
}

export const agentInviteSchema: z.ZodType<AgentInviteInput, unknown> = z.object({
  email: emailField,
  displayName: z.string().trim().min(1, "Display name is required").max(100, "Display name is too long"),
  permissions: z.array(z.enum(AGENT_PERMISSIONS)).max(AGENT_PERMISSIONS.length).default([]),
});

export interface AgentUpdateInput {
  status: "disabled";
}

export const agentUpdateSchema: z.ZodType<AgentUpdateInput, unknown> = z.object({
  status: z.literal("disabled"),
});
