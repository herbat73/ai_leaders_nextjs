"use client";

import { useState, type FormEvent, type ReactElement } from "react";

export interface ReturnRequestFormProps {
  /** Resolves with per-field errors on validation failure, or `null` on success. */
  onSubmit: (values: { orderNumber: string; customerEmail: string; reason: string }) => Promise<Record<string, string> | null>;
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40";

export function ReturnRequestForm({ onSubmit }: ReturnRequestFormProps): ReactElement {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const result = await onSubmit({
        orderNumber: String(data.get("orderNumber") ?? ""),
        customerEmail: String(data.get("customerEmail") ?? ""),
        reason: String(data.get("reason") ?? ""),
      });
      setErrors(result ?? {});
      if (!result) {
        form.reset();
        setSubmitted(true);
      }
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-green-50 p-6 text-green-800" role="status">
        <p className="font-semibold">Return request received.</p>
        <p className="mt-1 text-sm">We will email you once it has been reviewed.</p>
        <button className="mt-4 text-sm font-medium underline" onClick={() => setSubmitted(false)} type="button">
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="orderNumber" className="mb-1 block text-sm font-medium text-foreground">Order number</label>
        <input id="orderNumber" name="orderNumber" className={fieldClass} />
        {errors.orderNumber && <p className="mt-1 text-sm text-red-600">{errors.orderNumber}</p>}
      </div>
      <div>
        <label htmlFor="customerEmail" className="mb-1 block text-sm font-medium text-foreground">Email</label>
        <input id="customerEmail" name="customerEmail" type="email" className={fieldClass} />
        {errors.customerEmail && <p className="mt-1 text-sm text-red-600">{errors.customerEmail}</p>}
      </div>
      <div>
        <label htmlFor="reason" className="mb-1 block text-sm font-medium text-foreground">Reason for return</label>
        <textarea id="reason" name="reason" rows={4} className={fieldClass} />
        {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
      </div>
      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request return"}
      </button>
    </form>
  );
}
