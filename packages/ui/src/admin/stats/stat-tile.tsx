import type { ReactElement, ReactNode } from "react";

export interface StatTileProps {
  label: string;
  /** Text, never colour alone. */
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps): ReactElement {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }): ReactElement {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}
