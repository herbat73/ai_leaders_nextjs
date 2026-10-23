"use client";

import { useId, type ReactElement } from "react";

import { Banner } from "../banner";

export interface SummaryItem {
  title: string;
  quantityText: string;
  reasonText: string;
  comment?: string;
}

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryStepProps {
  itemsHeading: string;
  items: SummaryItem[];
  /** Method, resolution, amount and similar rows, already formatted. */
  rows: SummaryRow[];
  acknowledgement: { label: string; checked: boolean; onChange: (checked: boolean) => void; error?: string };
  submit: { label: string; pendingLabel: string; pending: boolean; onSubmit: () => void };
  /** Banner text for a failed submit. */
  errorText?: string;
}

/** Read-only recap, acknowledgement checkbox and submit button (idle, pending, error). */
export function SummaryStep({ itemsHeading, items, rows, acknowledgement, submit, errorText }: SummaryStepProps): ReactElement {
  const ackId = useId();
  const ackErrorId = `${ackId}-error`;
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-base font-semibold text-foreground">{itemsHeading}</h3>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                {item.title} <span className="font-normal text-muted-foreground">({item.quantityText})</span>
              </p>
              <p className="text-muted-foreground">{item.reasonText}</p>
              {item.comment && <p className="mt-1 text-foreground">{item.comment}</p>}
            </li>
          ))}
        </ul>
      </section>
      <dl className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <label htmlFor={ackId} className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <input
            id={ackId}
            type="checkbox"
            checked={acknowledgement.checked}
            onChange={(e) => acknowledgement.onChange(e.target.checked)}
            aria-describedby={acknowledgement.error ? ackErrorId : undefined}
            aria-invalid={acknowledgement.error ? true : undefined}
            className="mt-1 size-4 accent-primary"
          />
          <span>{acknowledgement.label}</span>
        </label>
        {acknowledgement.error && (
          <p id={ackErrorId} className="mt-1 text-sm text-red-600 dark:text-red-400">
            {acknowledgement.error}
          </p>
        )}
      </div>
      {errorText && <Banner tone="error">{errorText}</Banner>}
      <button
        type="button"
        onClick={submit.onSubmit}
        disabled={submit.pending}
        aria-disabled={submit.pending}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submit.pending ? submit.pendingLabel : submit.label}
      </button>
    </div>
  );
}
