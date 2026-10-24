"use client";

import { createContext, useContext, useId, type ReactElement, type ReactNode } from "react";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Control props (id, aria-describedby, aria-invalid) supplied by the surrounding `Field`, if any. */
export function useFieldControl(): { id?: string; "aria-describedby"?: string; "aria-invalid"?: true } {
  const ctx = useContext(FieldContext);
  if (!ctx) return {};
  return { id: ctx.id, "aria-describedby": ctx.describedBy, ...(ctx.invalid ? { "aria-invalid": true as const } : {}) };
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Label, hint and error around one `TextInput`/`Textarea`; binds label and descriptions to the control. */
export function Field({ label, hint, error, children }: FieldProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="mb-1 text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
