import type { ReactElement } from "react";

export function EmptyState({ message }: { message: string }): ReactElement {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}
