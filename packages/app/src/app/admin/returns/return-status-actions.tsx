"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { ReturnStatus } from "@easyrms/core";
import { apiCall, Button, ErrorMessage } from "@easyrms/ui/admin";

/**
 * Client island: moves a return along its allowed transitions through the API, then re-renders the server-fetched
 * list. Rejecting needs a note, whose field arrives with the decision card, so this offers every other move.
 */
export function ReturnStatusActions({ id, allowed }: { id: number; allowed: ReturnStatus[] }): ReactElement {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<ReturnStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: ReturnStatus): Promise<void> {
    setPendingStatus(status);
    setError(null);
    const result = await apiCall(`/api/returns/${id}`, { method: "PATCH", body: { status } });
    setPendingStatus(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  const isBusy = pendingStatus !== null || isRefreshing;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {allowed.filter((status) => status !== "rejected").map((status) => (
          <Button key={status} size="sm" variant="outline" disabled={isBusy} onClick={() => void changeStatus(status)}>
            {status}
          </Button>
        ))}
      </div>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
