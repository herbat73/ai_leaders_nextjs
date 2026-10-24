"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactElement } from "react";

import { Button } from "../button";
import { ErrorMessage } from "../feedback/error-message";
import { Input } from "../input";
import { Label } from "../label";

export interface CrudFormField {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea" | "password";
  /** HTML `autocomplete` token (e.g. `username`, `current-password`, `new-password`); password managers rely on it. */
  autoComplete?: string;
}

export interface CrudFormProps {
  fields: CrudFormField[];
  /** Field errors (`form` for a root error), or `null` when the values are valid. Typically wraps the shared Zod schema. */
  validate?: (values: Record<string, string>) => Record<string, string> | null;
  /** Resolves with server-side field errors, or `null` on success. */
  onSubmit: (values: Record<string, string>) => Promise<Record<string, string> | null>;
  onCancel?: () => void;
  submitLabel?: string;
  /** Submit button text while `onSubmit` is pending. Default is English: pass your own copy. */
  pendingLabel?: string;
  /** Cancel button text. Default is English: pass your own copy. */
  cancelLabel?: string;
  /** Texts of the show/hide toggle that `password` fields get. Defaults are English: pass your own copy. */
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

const TEXTAREA_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Field-driven form: shows errors next to fields, handles pending state, Cmd/Ctrl+Enter submits, Escape cancels. */
export function CrudForm({
  fields,
  validate,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  cancelLabel = "Cancel",
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
}: CrudFormProps): ReactElement {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const values = Object.fromEntries(fields.map((field) => [field.name, String(data.get(field.name) ?? "")]));
    const clientErrors = validate?.(values) ?? null;
    if (clientErrors) {
      setErrors(clientErrors);
      return;
    }
    setPending(true);
    try {
      const serverErrors = await onSubmit(values);
      setErrors(serverErrors ?? {});
      if (!serverErrors) form.reset();
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit(event.currentTarget);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.key === "Escape" && onCancel) onCancel();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit();
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4" noValidate>
      {fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label htmlFor={field.name}>{field.label}</Label>
          {field.type === "textarea" ? (
            <textarea id={field.name} name={field.name} rows={4} className={TEXTAREA_CLASS} />
          ) : field.type === "password" ? (
            <div className="flex gap-2">
              <Input
                id={field.name}
                name={field.name}
                type={revealed[field.name] ? "text" : "password"}
                autoComplete={field.autoComplete}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setRevealed((current) => ({ ...current, [field.name]: !current[field.name] }))}
              >
                {revealed[field.name] ? hidePasswordLabel : showPasswordLabel}
              </Button>
            </div>
          ) : (
            <Input id={field.name} name={field.name} type={field.type ?? "text"} autoComplete={field.autoComplete} />
          )}
          {errors[field.name] && <ErrorMessage message={errors[field.name]} />}
        </div>
      ))}
      {errors.form && <ErrorMessage message={errors.form} />}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
