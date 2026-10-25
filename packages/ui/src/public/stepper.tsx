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
  /** Visually hidden text announced after a completed step's label, e.g. "ukończony". */
  doneLabel: string;
}

/** Wizard progress: an ordered list, the current step carries `aria-current="step"`. */
export function Stepper({ steps, currentId, label, doneLabel }: StepperProps): ReactElement {
  const currentIndex = steps.findIndex((s) => s.id === currentId);
  return (
    <nav aria-label={label}>
      <ol className="flex overflow-x-auto">
        {steps.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li
              key={step.id}
              aria-current={state === "current" ? "step" : undefined}
              className={[
                "flex min-w-11 flex-1 flex-col items-center gap-1 border-b-[3px] px-1 pb-3 pt-1.5 text-center text-[0.8125rem] sm:min-w-[90px]",
                state === "done" ? "border-primary/40" : state === "current" ? "border-primary" : "border-muted",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "flex size-[26px] items-center justify-center rounded-full border-2 text-[0.8125rem] font-bold",
                  state === "upcoming" ? "border-border bg-card text-muted-foreground" : state === "current" ? "border-primary bg-card text-primary" : "border-primary bg-primary text-primary-foreground",
                ].join(" ")}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className={state === "current" ? "font-bold text-primary" : `max-sm:sr-only ${state === "done" ? "text-secondary-foreground" : "text-muted-foreground"}`}>{step.label}</span>
              {state === "done" && <span className="sr-only">{doneLabel}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
