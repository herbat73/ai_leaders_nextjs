"use client";

import { useId, type ReactElement } from "react";

import { ChoiceGroup, type ChoiceOption } from "../choice-group";
import { Field } from "../field";
import { Textarea } from "../textarea";

export interface ReasonsStepItem {
  lineId: string;
  title: string;
  reason: string | null;
  comment: string;
  /** Legend of the reason group for this item. */
  reasonLegend: string;
  commentLabel: string;
  commentHint?: string;
  /** Counter text, e.g. "120 / 500". */
  counterText: string;
  reasonError?: string;
  commentError?: string;
}

export interface ReasonsStepProps {
  items: ReasonsStepItem[];
  /** The reason codes with their labels. */
  reasonOptions: ChoiceOption[];
  maxCommentLength: number;
  onReasonChange: (lineId: string, reason: string) => void;
  onCommentChange: (lineId: string, comment: string) => void;
}

/** Per selected line: a reason choice and an optional comment with a character counter. */
export function ReasonsStep({
  items,
  reasonOptions,
  maxCommentLength,
  onReasonChange,
  onCommentChange,
}: ReasonsStepProps): ReactElement {
  const base = useId();
  return (
    <div className="space-y-6">
      {items.map((item) => {
        const counterId = `${base}-${item.lineId}-counter`;
        return (
          <section
            key={item.lineId}
            className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <h3 className="text-base font-semibold text-foreground">
              {item.title}
            </h3>
            <ChoiceGroup
              legend={item.reasonLegend}
              options={reasonOptions}
              value={item.reason}
              onChange={(v) => onReasonChange(item.lineId, v)}
              error={item.reasonError}
            />
            <Field
              label={item.commentLabel}
              hint={item.commentHint}
              error={item.commentError}
            >
              <Textarea
                aria-describedby={counterId}
                value={item.comment}
                maxLength={maxCommentLength}
                onChange={(e) => onCommentChange(item.lineId, e.target.value)}
              />
            </Field>
            <p
              id={counterId}
              className="text-right text-sm text-muted-foreground"
            >
              {item.counterText}
            </p>
          </section>
        );
      })}
    </div>
  );
}
