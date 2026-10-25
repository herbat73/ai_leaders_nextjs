import { hasPermission } from "@easyrms/core";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { AgentsManager } from "./agents-manager";
import { agentsCopy as copy } from "./copy";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const agent = await requireAgentPage("/admin/agents");

  // Only agents who may manage agents see the list; the API checks the same permission again.
  if (!hasPermission(agent, "MANAGE_RULES")) {
    return (
      <AdminShell agent={agent}>
        <main className="mx-auto max-w-3xl p-8">
          <Alert variant="destructive">
            <AlertTitle>{copy.forbiddenTitle}</AlertTitle>
            <AlertDescription>{copy.forbidden}</AlertDescription>
          </Alert>
        </main>
      </AdminShell>
    );
  }

  const scope = await createRequestScope();
  const agents = await scope.cradle.agentService.list();

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(agents.length)}</CardDescription>
          </CardHeader>
          <CardContent>
            <AgentsManager agents={agents} currentAgentId={agent.id} />
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
