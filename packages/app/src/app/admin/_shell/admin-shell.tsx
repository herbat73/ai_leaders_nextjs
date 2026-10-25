import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { hasPermission, type AgentContext } from "@easyrms/core";

import { shellCopy as copy } from "./copy";
import { LogoutButton } from "./logout-button";

/**
 * The admin page chrome: signed-in agent, navigation and logout. It takes the agent that `requireAgentPage` returned,
 * so a page that forgets the guard also has no header, which is visibly wrong in review and in the browser.
 */
export function AdminShell({ agent, children }: { agent: AgentContext; children: ReactNode }): ReactElement {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-8 py-3">
          <nav aria-label={copy.navLabel} className="flex items-center gap-4 text-sm">
            <Link href="/admin/returns" className="font-medium underline-offset-4 hover:underline">
              {copy.returns}
            </Link>
            {hasPermission(agent, "MANAGE_RULES") && (
              <Link href="/admin/agents" className="font-medium underline-offset-4 hover:underline">
                {copy.agents}
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{copy.signedInAs(agent.displayName)}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
