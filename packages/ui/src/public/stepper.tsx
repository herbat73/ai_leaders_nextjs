import type { ReactElement } from "react";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentId: string;
  /** Accessible name of the list. */
  label?: string;
}

/** Wizard progress: an ordered list, the current step carries `aria-current="step"`. */
export function Stepper({ steps, currentId, label }: StepperProps): ReactElement {
  const currentIndex = steps.findIndex((s) => s.id === currentId);
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap gap-x-4 gap-y-2">
        {steps.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li key={step.id} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={[
                  "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "upcoming" ? "border-border text-muted-foreground" : "border-primary bg-primary text-primary-foreground",
                ].join(" ")}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className={state === "current" ? "font-semibold text-foreground" : "text-muted-foreground"}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
