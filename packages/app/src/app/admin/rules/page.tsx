import { hasPermission } from "@easyrms/core";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardDescription, CardHeader, CardTitle, RuleSummary } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { resolveRulesService } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { rulesCopy as copy } from "./copy";
import { WhatIf } from "./what-if";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const agent = await requireAgentPage("/admin/rules");

  // Only agents who may manage rules see them; the API checks the same permission again.
  if (!hasPermission(agent, "MANAGE_RULES")) {
    return (
      <AdminShell agent={agent}>
        <main lang="pl" className="mx-auto max-w-3xl p-8">
          <Alert variant="destructive">
            <AlertTitle>{copy.forbiddenTitle}</AlertTitle>
            <AlertDescription>{copy.forbidden}</AlertDescription>
          </Alert>
        </main>
      </AdminShell>
    );
  }

  const rules = (await resolveRulesService()).listRules();

  return (
    <AdminShell agent={agent}>
      <main lang="pl" className="mx-auto max-w-5xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <RuleSummary rules={rules} labels={copy.ruleLabels} />
          </CardContent>
        </Card>
        <WhatIf
          tunable={rules
            .filter((rule) => rule.thresholdMinor !== null)
            .map((rule) => ({ id: rule.id, name: rule.name, thresholdMinor: rule.thresholdMinor as number }))}
        />
      </main>
    </AdminShell>
  );
}
