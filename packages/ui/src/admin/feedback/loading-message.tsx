import type { ReactElement } from "react";

export function LoadingMessage({ message = "Loading…" }: { message?: string }): ReactElement {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {message}
    </p>
  );
}
