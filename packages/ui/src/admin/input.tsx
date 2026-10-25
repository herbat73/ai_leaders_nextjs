import * as React from "react";

import { cn } from "../lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return (
    <input
      className={cn(
        "flex min-h-[46px] w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive aria-invalid:bg-destructive-subtle",
        className,
      )}
      {...props}
    />
  );
}
