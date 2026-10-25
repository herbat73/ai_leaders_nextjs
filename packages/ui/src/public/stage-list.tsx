import type { ReactElement } from "react";

export type StageState = "done" | "current" | "upcoming";

export interface Stage {
  id: string;
  label: string;
  state: StageState;
}

export interface StageListProps {
  stages: Stage[];
  /** When set, the stages are replaced by a closed state (rejected, cancelled). */
  closed?: { label: string; reason?: string };
  /** Accessible name of the list. */
  label?: string;
}

/** Status tracker: ordered stages with `aria-current="step"` on the current one, or a closed state. */
export function StageList({ stages, closed, label }: StageListProps): ReactElement {
  if (closed) {
    return (
      <div role="group" aria-label={label} className="rounded-md border border-border bg-muted px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{closed.label}</p>
        {closed.reason && <p className="mt-1 text-sm text-muted-foreground">{closed.reason}</p>}
      </div>
    );
  }

  return (
    <ol aria-label={label} className="space-y-3">
      {stages.map((stage, index) => (
        <li key={stage.id} aria-current={stage.state === "current" ? "step" : undefined} className="flex items-center gap-3 text-sm">
          <span
            aria-hidden="true"
            className={[
              "flex size-[26px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              stage.state === "upcoming" ? "border-border text-muted-foreground" : "border-primary bg-primary text-primary-foreground",
              stage.state === "current" ? "ring-4 ring-accent" : "",
            ].join(" ")}
          >
            {stage.state === "done" ? "✓" : index + 1}
          </span>
          <span className={stage.state === "current" ? "font-semibold text-foreground" : stage.state === "done" ? "text-foreground" : "text-muted-foreground"}>
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
