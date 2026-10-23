"use client";

import { useId, type ReactElement } from "react";

export interface LinePickerLine {
  id: string;
  title: string;
  /** Secondary text, e.g. SKU and unit price (already formatted). */
  detail?: string;
  /** Upper bound of the stepper. */
  remainingQuantity: number;
  eligible: boolean;
  /** Shown as text when the line is not eligible. */
  ineligibleReason?: string;
  selected: boolean;
  quantity: number;
  /** Shown while the quantity sits at the cap, e.g. "Maksymalnie 2 szt.". */
  capText?: string;
  /** Accessible name of the quantity input for this line. */
  quantityLabel: string;
}

export interface LinePickerProps {
  legend: string;
  lines: LinePickerLine[];
  decreaseLabel: string;
  increaseLabel: string;
  onToggle: (lineId: string, selected: boolean) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  error?: string;
}

/** Order lines with a checkbox and a quantity stepper capped at the remaining quantity. */
export function LinePicker({ legend, lines, decreaseLabel, increaseLabel, onToggle, onQuantityChange, error }: LinePickerProps): ReactElement {
  const base = useId();
  const errorId = `${base}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      {lines.map((line) => {
        const checkId = `${base}-${line.id}`;
        const reasonId = `${checkId}-reason`;
        const capId = `${checkId}-cap`;
        const atCap = line.quantity >= line.remainingQuantity;
        return (
          <div
            key={line.id}
            className={[
              "rounded-lg border bg-background p-3 shadow-sm",
              line.eligible ? (line.selected ? "border-primary ring-1 ring-primary" : "border-input") : "border-border opacity-70",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <input
                id={checkId}
                type="checkbox"
                checked={line.selected}
                disabled={!line.eligible}
                onChange={(e) => onToggle(line.id, e.target.checked)}
                aria-describedby={!line.eligible && line.ineligibleReason ? reasonId : undefined}
                className="mt-1 size-4 accent-primary"
              />
              <label htmlFor={checkId} className={`block flex-1 ${line.eligible ? "cursor-pointer" : "cursor-not-allowed"}`}>
                <span className="block text-sm font-medium text-foreground">{line.title}</span>
                {line.detail && <span className="block text-sm text-muted-foreground">{line.detail}</span>}
              </label>
            </div>
            {!line.eligible && line.ineligibleReason && (
              <p id={reasonId} className="mt-1 pl-7 text-sm font-medium text-amber-800 dark:text-amber-300">
                {line.ineligibleReason}
              </p>
            )}
            {line.eligible && line.selected && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                <button
                  type="button"
                  aria-label={decreaseLabel}
                  disabled={line.quantity <= 1}
                  onClick={() => onQuantityChange(line.id, line.quantity - 1)}
                  className="size-10 rounded-lg border border-input text-lg focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">−</span>
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={line.remainingQuantity}
                  value={line.quantity}
                  aria-label={line.quantityLabel}
                  aria-describedby={atCap && line.capText ? capId : undefined}
                  onChange={(e) => {
                    const n = Math.trunc(Number(e.target.value));
                    if (Number.isFinite(n)) onQuantityChange(line.id, Math.min(line.remainingQuantity, Math.max(1, n)));
                  }}
                  className="h-10 w-16 rounded-lg border border-input bg-background px-2 text-center text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                />
                <button
                  type="button"
                  aria-label={increaseLabel}
                  disabled={atCap}
                  onClick={() => onQuantityChange(line.id, line.quantity + 1)}
                  className="size-10 rounded-lg border border-input text-lg focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">+</span>
                </button>
                {atCap && line.capText && (
                  <span id={capId} className="text-sm text-muted-foreground">
                    {line.capText}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
