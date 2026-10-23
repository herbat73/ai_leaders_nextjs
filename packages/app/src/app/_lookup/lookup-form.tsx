"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { apiCall } from "@easyrms/ui/api";
import { Banner, Field, TextInput } from "@easyrms/ui/public";

import { errorMessage } from "../returns/_lib/error-copy";
import { lookupCopy as copy } from "./copy";

/** Mirrors `ReturnLookupView` from core (only what this island reads). */
interface LookupResponse {
  deliveredAt: string | null;
  trackingUrl?: string | null;
}

type Outcome = { kind: "error"; message: string } | { kind: "not_delivered"; trackingUrl: string | null } | null;

/** Client island: looks the order up; a delivered order starts the guest session (cookie) and opens the overview. */
export function LookupForm(): ReactElement {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setOutcome(null);
    setFieldErrors({});
    const result = await apiCall<LookupResponse>("/api/returns/lookup", { method: "POST", body: { orderNumber, email } });
    if (!result.ok) {
      const { key, message } = errorMessage(result.error, result.status);
      if (key === "validation_error" && result.error.fieldErrors) setFieldErrors(result.error.fieldErrors);
      else setOutcome({ kind: "error", message });
      setPending(false);
      return;
    }
    if (result.data.deliveredAt === null) {
      setOutcome({ kind: "not_delivered", trackingUrl: result.data.trackingUrl ?? null });
      setPending(false);
      return;
    }
    router.push("/returns");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
      {outcome?.kind === "error" && <Banner tone="error">{outcome.message}</Banner>}
      {outcome?.kind === "not_delivered" && (
        <Banner tone="info">
          <p>{copy.notDelivered}</p>
          {outcome.trackingUrl && (
            <p className="mt-2">
              <a href={outcome.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {copy.trackingLink}
              </a>
            </p>
          )}
        </Banner>
      )}
      <Field label={copy.orderNumberLabel} hint={copy.orderNumberHint} error={fieldErrors.orderNumber}>
        <TextInput
          name="orderNumber"
          autoComplete="off"
          required
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
        />
      </Field>
      <Field label={copy.emailLabel} error={fieldErrors.email}>
        <TextInput
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-foreground px-4 py-2 font-medium text-background shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
