"use client";

import type { ReactElement } from "react";

import { ChoiceGroup, type ChoiceOption } from "../choice-group";

export interface MethodStepProps {
  legend: string;
  /** Methods; the fee text goes into each option's `description`. */
  options: ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
}

/** Return method choice (the fee per option is part of the passed description). */
export function MethodStep({ legend, options, value, onChange, error }: MethodStepProps): ReactElement {
  return <ChoiceGroup legend={legend} options={options} value={value} onChange={onChange} error={error} />;
}
