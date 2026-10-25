"use client";

import type { InputHTMLAttributes, ReactElement } from "react";

import { useFieldControl } from "./field";

export const publicControlClass =
  "min-h-[46px] w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive-subtle aria-[invalid=true]:focus-visible:ring-destructive/35 disabled:cursor-not-allowed disabled:opacity-55";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** Native input; inside a `Field` it takes id, description and invalid state from it. */
export function TextInput({ className, ...props }: TextInputProps): ReactElement {
  const control = useFieldControl();
  return <input type="text" {...control} {...props} className={[publicControlClass, className].filter(Boolean).join(" ")} />;
}
