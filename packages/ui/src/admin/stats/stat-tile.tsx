import type { ReactElement, ReactNode } from "react";

export interface StatTileProps {
  label: string;
  /** Text, never colour alone. */
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps): ReactElement {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5 text-card-foreground shadow-sm">
      <dt className="text-[0.8125rem] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[1.6rem] font-extrabold tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }): ReactElement {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}
