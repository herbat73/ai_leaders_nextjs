import * as React from "react";

import { cn } from "../lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>): React.ReactElement {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-top border-collapse text-base", className)} {...props} />
    </div>
  );
}

export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>): React.ReactElement {
  return <thead className="[&_tr]:border-b" {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>): React.ReactElement {
  return <tbody className="[&_tr:last-child]:border-0" {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>): React.ReactElement {
  return <tr className={cn("border-b transition-colors hover:bg-background", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): React.ReactElement {
  return <th className={cn("h-11 px-3.5 text-left align-middle text-[0.8125rem] font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): React.ReactElement {
  return <td className={cn("px-3.5 py-3 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>): React.ReactElement {
  return <caption className={cn("mb-2 text-left text-sm font-medium text-muted-foreground", className)} {...props} />;
}
