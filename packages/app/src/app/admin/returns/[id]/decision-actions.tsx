"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { checkDecisionNote, REJECT_NOTE_MIN_LENGTH, type ReturnStatus } from "@easyrms/core";
import { apiCall, Button, ErrorMessage, Label, Textarea } from "@easyrms/ui/admin";

import { returnsCopy } from "../copy";

const copy = returnsCopy.card;
const REJECT_BUTTON_ID = "reject-open";
const NOTE_FIELD_ID = "reject-note";
const NOTE_HINT_ID = "reject-note-hint";
const NOTE_COUNTER_ID = "reject-note-counter";

function statusLabel(status: string | undefined): string {
  return status !== undefined && status in returnsCopy.statusLabels
    ? returnsCopy.statusLabels[status as keyof typeof returnsCopy.statusLabels]
    : (status ?? "?");
}

/**
 * Client island of the decision card: one button per allowed move. Rejecting opens a required note field; this is a
 * bespoke form because `CrudForm` has no hook for the live counter or its `aria-live` announcement.
 */
export function DecisionActions({ id, allowed }: { id: number; allowed: ReturnStatus[] }): ReactElement {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<ReturnStatus | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const wasRejecting = useRef(false);

  // The reject button disappears when the form opens: move focus into the form, and back to the button on cancel.
  useEffect(() => {
    if (rejecting) noteRef.current?.focus();
    else if (wasRejecting.current) document.getElementById(REJECT_BUTTON_ID)?.focus();
    wasRejecting.current = rejecting;
  }, [rejecting]);

  const isBusy = pendingStatus !== null || isRefreshing;
  const typed = note.trim().length;
  const noteIsValid = checkDecisionNote("rejected", note).ok;

  async function move(status: ReturnStatus, decisionNote?: string): Promise<void> {
    setPendingStatus(status);
    setError(null);
    const result = await apiCall(`/api/returns/${id}`, {
      method: "PATCH",
      body: decisionNote === undefined ? { status } : { status, decisionNote },
    });
    setPendingStatus(null);

    if (!result.ok) {
      if (result.status === 409) {
        // A stale tab: show what the request is now and refresh the card.
        setError(copy.conflict(statusLabel(result.error.fieldErrors?.status)));
        setRejecting(false);
        startTransition(() => router.refresh());
      } else {
        setError(result.error.fieldErrors?.decisionNote ?? copy.genericError);
      }
      return;
    }
    setRejecting(false);
    setNote("");
    startTransition(() => router.refresh());
  }

  function submitRejection(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (noteIsValid && !isBusy) void move("rejected", note.trim());
  }

  const direct = allowed.filter((status) => status !== "rejected");
  const canReject = allowed.includes("rejected");

  if (allowed.length === 0 && error === null) return <p className="text-sm text-muted-foreground">{copy.noActions}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {direct.map((status) => (
          <Button key={status} disabled={isBusy} onClick={() => void move(status)}>
            {returnsCopy.actionLabels[status]}
          </Button>
        ))}
        {canReject && !rejecting && (
          <Button id={REJECT_BUTTON_ID} variant="destructive" disabled={isBusy} onClick={() => setRejecting(true)}>
            {returnsCopy.actionLabels.rejected}
          </Button>
        )}
      </div>

      {canReject && rejecting && (
        <form onSubmit={submitRejection} className="space-y-3" aria-labelledby="reject-title">
          <p id="reject-title" className="text-sm font-medium">
            {copy.rejectTitle}
          </p>
          <div className="space-y-1">
            <Label htmlFor={NOTE_FIELD_ID}>{copy.rejectNoteLabel}</Label>
            <Textarea
              ref={noteRef}
              id={NOTE_FIELD_ID}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`${NOTE_HINT_ID} ${NOTE_COUNTER_ID}`}
              aria-invalid={typed > 0 && !noteIsValid}
              required
            />
            <p id={NOTE_HINT_ID} className="text-xs text-muted-foreground">
              {copy.rejectNoteHint(REJECT_NOTE_MIN_LENGTH)}
            </p>
            <p id={NOTE_COUNTER_ID} aria-live="polite" className="text-xs text-muted-foreground">
              {copy.rejectCounter(typed, REJECT_NOTE_MIN_LENGTH)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={!noteIsValid || isBusy}>
              {copy.rejectSubmit}
            </Button>
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => setRejecting(false)}>
              {copy.rejectCancel}
            </Button>
          </div>
        </form>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
