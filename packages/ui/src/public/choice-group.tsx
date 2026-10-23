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
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
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
              "flex items-start gap-3 rounded-lg border bg-background p-3 shadow-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60",
              option.disabled ? "cursor-not-allowed border-border opacity-70" : "cursor-pointer border-input hover:bg-muted",
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
              aria-invalid={error ? true : undefined}
              className="mt-1 size-4 accent-primary"
            />
            <span className="block">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              {option.description && (
                <span id={descId} className="block text-sm text-muted-foreground">
                  {option.description}
                </span>
              )}
              {option.disabled && option.disabledReason && (
                <span id={reasonId} className="mt-1 block text-sm font-medium text-amber-800 dark:text-amber-300">
                  {option.disabledReason}
                </span>
              )}
            </span>
          </label>
        );
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
