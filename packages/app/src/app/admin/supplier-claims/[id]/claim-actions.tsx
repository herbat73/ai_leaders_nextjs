"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactElement } from "react";
import { CLAIM_REJECTION_NOTE_MIN_LENGTH, parseMoney, type SupplierClaimStatus } from "@easyrms/core";
import { apiCall, Button, ErrorMessage, Input, Label, Textarea } from "@easyrms/ui/admin";

import { claimsCopy } from "../copy";

const copy = claimsCopy.actions;

type Form = "accepted" | "rejected" | null;

/**
 * Client island of the claim page: retry sending a draft, record the vendor's answer (an acceptance needs an amount, a
 * rejection a reason) and mark the credit note as booked. The server stays authoritative on every rule.
 */
export function ClaimActions({ id, allowed }: { id: number; allowed: SupplierClaimStatus[] }): ReactElement {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || isRefreshing;

  function fail(status: number, code: string, fieldErrors?: Record<string, string>, currentStatus?: string): void {
    if (code === "mail_not_configured") return setError(copy.mailNotConfigured);
    if (code === "mail_failed") return setError(copy.mailFailed);
    if (status === 409) {
      setForm(null);
      setError(copy.conflict(currentStatus ? (claimsCopy.statusLabels[currentStatus as keyof typeof claimsCopy.statusLabels] ?? currentStatus) : "?"));
      return startTransition(() => router.refresh());
    }
    if (fieldErrors?.creditAmount === "above_claim_value") return setFieldError(copy.amountTooHigh);
    setError(copy.genericError);
  }

  async function call(path: string, method: "PATCH" | "POST", body?: unknown): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await apiCall(path, { method, ...(body === undefined ? {} : { body }) });
    setPending(false);
    if (!result.ok) {
      fail(result.status, result.error.code, result.error.fieldErrors, result.error.fieldErrors?.status);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldError(null);
    if (form === "accepted") {
      const parsed = parseMoney(amount);
      if (!parsed || parsed.amountMinor <= 0) return setFieldError(copy.amountInvalid);
      if (await call(`/api/supplier-claims/${id}`, "PATCH", { status: "accepted", creditAmount: amount, ...(note.trim() ? { note: note.trim() } : {}) })) setForm(null);
    } else if (form === "rejected") {
      if (note.trim().length < CLAIM_REJECTION_NOTE_MIN_LENGTH) return setFieldError(copy.noteTooShort(CLAIM_REJECTION_NOTE_MIN_LENGTH));
      if (await call(`/api/supplier-claims/${id}`, "PATCH", { status: "rejected", note: note.trim() })) setForm(null);
    }
  }

  function open(next: Form): void {
    setForm(next);
    setAmount("");
    setNote("");
    setFieldError(null);
    setError(null);
  }

  if (allowed.length === 0 && error === null) return <p className="text-sm text-muted-foreground">{claimsCopy.page.noActions}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {allowed.includes("sent") && (
          <Button disabled={busy} onClick={() => void call(`/api/supplier-claims/${id}/send`, "POST")}>
            {pending ? copy.sending : copy.send}
          </Button>
        )}
        {allowed.includes("accepted") && form !== "accepted" && (
          <Button disabled={busy} onClick={() => open("accepted")}>
            {copy.markAccepted}
          </Button>
        )}
        {allowed.includes("rejected") && form !== "rejected" && (
          <Button variant="destructive" disabled={busy} onClick={() => open("rejected")}>
            {copy.markRejected}
          </Button>
        )}
        {allowed.includes("credited") && (
          <Button disabled={busy} onClick={() => void call(`/api/supplier-claims/${id}`, "PATCH", { status: "credited" })}>
            {copy.markCredited}
          </Button>
        )}
      </div>

      {form && (
        <form onSubmit={submitAnswer} noValidate className="space-y-3">
          {form === "accepted" && (
            <div className="space-y-1">
              <Label htmlFor="claim-amount">{copy.creditAmountLabel}</Label>
              <Input id="claim-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby="claim-amount-hint" aria-invalid={fieldError !== null} />
              <p id="claim-amount-hint" className="text-xs text-muted-foreground">
                {copy.creditAmountHint}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="claim-note">{form === "accepted" ? copy.acceptedNoteLabel : copy.rejectedNoteLabel}</Label>
            <Textarea
              id="claim-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={form === "rejected" && fieldError !== null}
              {...(form === "rejected" ? { "aria-describedby": "claim-note-hint" } : {})}
            />
            {form === "rejected" && (
              <p id="claim-note-hint" className="text-xs text-muted-foreground">
                {copy.rejectedNoteHint(CLAIM_REJECTION_NOTE_MIN_LENGTH)}
              </p>
            )}
          </div>
          {fieldError && <ErrorMessage message={fieldError} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant={form === "rejected" ? "destructive" : "default"} disabled={busy}>
              {pending ? copy.saving : form === "accepted" ? copy.submitAccepted : copy.submitRejected}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
