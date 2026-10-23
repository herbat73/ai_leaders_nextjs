import { BRIEF_RULES, describeRule } from "@easyrms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, RuleSummary } from "@easyrms/ui/admin";

import { labCopy as copy } from "./copy";
import { CaseSampleLab } from "./case-sample-lab";

const rules = BRIEF_RULES.map((rule) => ({ id: rule.id, name: rule.name, enabled: rule.enabled, ...describeRule(rule) }));

export default function CaseSamplePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {copy.collect.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <a href="/case-sample-template.csv" download className="text-sm underline underline-offset-4">
            {copy.templateLink}
          </a>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{copy.rulesTitle}</h2>
            <RuleSummary rules={rules} labels={copy.ruleLabels} />
          </div>
          <p className="text-sm text-muted-foreground">{copy.discard}</p>
        </CardContent>
      </Card>
      <CaseSampleLab />
    </main>
  );
}
