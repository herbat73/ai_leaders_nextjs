import * as React from "react";

import { cn } from "../lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>): React.ReactElement {
  return <label className={cn("text-base font-semibold leading-none", className)} {...props} />;
}
