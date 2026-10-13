import type { ReactElement } from "react";

export function ErrorMessage({ message }: { message: string }): ReactElement {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
