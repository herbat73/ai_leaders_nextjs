"use client";

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import { ActionButton } from "../action-button";
import { Stepper, type StepperStep } from "../stepper";

export interface WizardShellProps {
  steps: StepperStep[];
  currentId: string;
  stepperLabel: string;
  /** Visually hidden suffix for completed steps in the stepper, e.g. "ukończony". */
  stepDoneLabel: string;
  heading: string;
  /** Changing this value moves focus to the heading (pass the current step id). */
  focusKey: string;
  backLabel: string;
  nextLabel: string;
  /** Hide Back on the first step. */
  showBack: boolean;
  /** Hide Next on the last step (the step supplies its own submit). */
  showNext: boolean;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
}

/** Stepper, focusable step heading (focus moves on step change) and Back/Next buttons. */
export function WizardShell(props: WizardShellProps): ReactElement {
  const { steps, currentId, stepperLabel, stepDoneLabel, heading, focusKey, backLabel, nextLabel, showBack, showNext, nextDisabled, backDisabled, onBack, onNext, children } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [focusKey]);
  return (
    <div className="space-y-6">
      <Stepper steps={steps} currentId={currentId} label={stepperLabel} doneLabel={stepDoneLabel} />
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
        {heading}
      </h2>
      <div>{children}</div>
      {(showBack || showNext) && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {showBack ? (
            <ActionButton variant="secondary" size="lg" onClick={onBack} disabled={backDisabled}>
              {backLabel}
            </ActionButton>
          ) : (
            <span />
          )}
          {showNext && (
            <ActionButton size="lg" onClick={onNext} disabled={nextDisabled}>
              {nextLabel}
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
