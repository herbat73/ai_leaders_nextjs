"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

/** Re-runs the Server Component (and so the order lookup) after a platform outage. */
export function RetryButton({ label }: { label: string }): ReactElement {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
      {label}
    </button>
  );
}
