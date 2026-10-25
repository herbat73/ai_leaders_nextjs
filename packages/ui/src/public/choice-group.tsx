"use client";

import { useId, type ReactElement } from "react";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Shown as text when the option is disabled. */
  disabledReason?: string;
}

export interface ChoiceGroupProps {
  legend: string;
  options: ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Optional error text, linked to the group through `aria-describedby`. */
  error?: string;
}

/** Radio cards inside a fieldset. Disabled options explain themselves as text, not only by colour. */
export function ChoiceGroup({ legend, options, value, onChange, error }: ChoiceGroupProps): ReactElement {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-2.5">
      <legend className="mb-2 font-semibold text-foreground">{legend}</legend>
      {options.map((option) => {
        const inputId = `${name}-${option.value}`;
        const reasonId = `${inputId}-reason`;
        const descId = `${inputId}-desc`;
        const describedBy = [option.description ? descId : null, option.disabled && option.disabledReason ? reasonId : null]
          .filter(Boolean)
          .join(" ");
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className={[
              "flex items-start gap-3.5 rounded-lg border-[1.5px] bg-card px-4 py-3.5 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/35",
              option.disabled ? "cursor-not-allowed border-border opacity-70" : "cursor-pointer border-border hover:border-input",
            ].join(" ")}
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
              className="mt-0.5 size-5 accent-primary"
            />
            <span className="block">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              {option.description && (
                <span id={descId} className="block text-sm text-muted-foreground">
                  {option.description}
                </span>
              )}
              {option.disabled && option.disabledReason && (
                <span id={reasonId} className="mt-1 block text-sm font-medium text-warning-subtle-foreground">
                  {option.disabledReason}
                </span>
              )}
            </span>
          </label>
        );
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </fieldset>
  );
}
