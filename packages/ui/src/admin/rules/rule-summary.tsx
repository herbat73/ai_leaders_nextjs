import type { ReactElement } from "react";

import { Badge } from "../badge";

export interface RuleSummaryItem {
  id: string;
  name: string;
  enabled: boolean;
  conditions: string[];
  actions: string[];
  settles: boolean;
}

export interface RuleSummaryProps {
  rules: RuleSummaryItem[];
  labels: { settles: string; routes: string; disabled: string; when: string; then: string };
}

/** Read-only list of rule definitions; the caller supplies the described (already translated) text. */
export function RuleSummary({ rules, labels }: RuleSummaryProps): ReactElement {
  return (
    <ul className="space-y-3">
      {rules.map((rule) => (
        <li key={rule.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{rule.id}</span>
            <span>{rule.name}</span>
            <Badge variant={rule.settles ? "default" : "secondary"}>{rule.settles ? labels.settles : labels.routes}</Badge>
            {!rule.enabled && <Badge variant="outline">{labels.disabled}</Badge>}
          </div>
          <p className="mt-2 text-muted-foreground">
            <span className="font-medium text-foreground">{labels.when}:</span> {rule.conditions.join("; ") || "—"}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{labels.then}:</span> {rule.actions.join("; ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
