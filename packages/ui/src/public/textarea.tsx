"use client";

import type { ReactElement, TextareaHTMLAttributes } from "react";

import { useFieldControl } from "./field";
import { publicControlClass } from "./text-input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Native textarea; inside a `Field` it takes id, description and invalid state from it (an own `aria-describedby` is appended). */
export function Textarea({ className, rows = 4, ...props }: TextareaProps): ReactElement {
  const control = useFieldControl();
  const describedBy = [control["aria-describedby"], props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return <textarea rows={rows} {...control} {...props} aria-describedby={describedBy} className={[publicControlClass, className].filter(Boolean).join(" ")} />;
}
