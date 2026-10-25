import { ForbiddenError } from "../../errors";
import type { AgentContext, AgentPermission } from "./types";

export function hasPermission(agent: Pick<AgentContext, "permissions">, permission: AgentPermission): boolean {
  return agent.permissions.includes(permission);
}

/** 403 `forbidden` unless the agent holds the permission. Authentication (401) is a separate, earlier check. */
export function requirePermission(agent: Pick<AgentContext, "permissions">, permission: AgentPermission): void {
  if (!hasPermission(agent, permission)) throw new ForbiddenError("Missing permission", "forbidden");
}
