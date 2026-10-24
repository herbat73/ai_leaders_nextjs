"use client";

import type { InputHTMLAttributes, ReactElement } from "react";

import { useFieldControl } from "./field";

export const publicControlClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-60";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** Native input; inside a `Field` it takes id, description and invalid state from it. */
export function TextInput({ className, ...props }: TextInputProps): ReactElement {
  const control = useFieldControl();
  return <input type="text" {...control} {...props} className={[publicControlClass, className].filter(Boolean).join(" ")} />;
}
