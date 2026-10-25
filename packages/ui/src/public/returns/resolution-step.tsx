"use client";

import type { ReactElement } from "react";

import { ChoiceGroup, type ChoiceOption } from "../choice-group";
import { Banner } from "../banner";
import { Field } from "../field";
import { TextInput } from "../text-input";

export type ResolutionQuoteView =
  | { status: "idle" }
  | { status: "pending"; pendingText: string }
  | { status: "ready"; title: string; amountLabel: string; amountText: string; feeLabel?: string; feeText?: string }
  | { status: "error"; errorText: string };

export interface ResolutionStepProps {
  legend: string;
  options: ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  quote: ResolutionQuoteView;
  /** Present only when the chosen resolution is an exchange. */
  exchange?: { label: string; hint?: string; value: string; onChange: (value: string) => void; error?: string };
}

/** Resolution choice with a live quote region (`aria-live`) and an exchange note for exchanges. */
export function ResolutionStep({ legend, options, value, onChange, error, quote, exchange }: ResolutionStepProps): ReactElement {
  return (
    <div className="space-y-4">
      <ChoiceGroup legend={legend} options={options} value={value} onChange={onChange} error={error} />
      {exchange && (
        <Field label={exchange.label} hint={exchange.hint} error={exchange.error}>
          <TextInput value={exchange.value} onChange={(e) => exchange.onChange(e.target.value)} />
        </Field>
      )}
      <div aria-live="polite" aria-atomic="true" aria-busy={quote.status === "pending"}>
        {quote.status === "pending" && <p className="text-sm text-muted-foreground">{quote.pendingText}</p>}
        {quote.status === "ready" && (
          <div className="rounded-md bg-muted p-3.5">
            <p className="text-sm font-medium text-foreground">{quote.title}</p>
            <dl className="mt-1 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{quote.amountLabel}</dt>
                <dd className="font-semibold text-foreground">{quote.amountText}</dd>
              </div>
              {quote.feeLabel && quote.feeText && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{quote.feeLabel}</dt>
                  <dd className="text-foreground">{quote.feeText}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
      {quote.status === "error" && <Banner tone="error">{quote.errorText}</Banner>}
    </div>
  );
}
