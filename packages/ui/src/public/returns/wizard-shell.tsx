"use client";

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import { Stepper, type StepperStep } from "../stepper";

export interface WizardShellProps {
  steps: StepperStep[];
  currentId: string;
  stepperLabel: string;
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
  const { steps, currentId, stepperLabel, heading, focusKey, backLabel, nextLabel, showBack, showNext, nextDisabled, backDisabled, onBack, onNext, children } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [focusKey]);

  const buttonClass =
    "rounded-lg px-4 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="space-y-6">
      <Stepper steps={steps} currentId={currentId} label={stepperLabel} />
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        {heading}
      </h2>
      <div>{children}</div>
      {(showBack || showNext) && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {showBack ? (
            <button type="button" onClick={onBack} disabled={backDisabled} className={`${buttonClass} border border-input text-foreground`}>
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          {showNext && (
            <button type="button" onClick={onNext} disabled={nextDisabled} className={`${buttonClass} bg-primary text-primary-foreground`}>
              {nextLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
