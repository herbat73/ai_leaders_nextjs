"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import { composeSupplierClaim, type ClaimComposition, type ClaimDelivery } from "@easyrms/core";
import {
  apiCall,
  Button,
  ErrorMessage,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@easyrms/ui/admin";

import { claimsCopy } from "../../supplier-claims/copy";

const copy = claimsCopy.section;
const NOTE_MAX = 1000;

export interface ClaimSupplierOption {
  id: number;
  name: string;
  guidelines: string | null;
}

/**
 * Client island of the decision card: pick the vendor, add a note, see the e-mail exactly as it will go, send it. The
 * preview uses the same pure composer as the server, so what the agent reads is what is stored and sent.
 */
export function SupplierClaimForm({
  returnId,
  suppliers,
  composition,
  mailDelivers,
}: {
  returnId: number;
  suppliers: ClaimSupplierOption[];
  composition: Omit<ClaimComposition, "supplierName" | "agentNote">;
  mailDelivers: boolean;
}): ReactElement {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string>("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimDelivery | null>(null);

  const supplier = suppliers.find((candidate) => String(candidate.id) === supplierId);
  const preview = useMemo(
    () => (supplier ? composeSupplierClaim({ ...composition, supplierName: supplier.name, agentNote: note.trim() || null }) : null),
    [composition, supplier, note],
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!supplier) return setSupplierError(copy.supplierRequired);
    if (note.trim().length > NOTE_MAX) return setError(copy.noteTooLong);
    setSupplierError(null);
    setPending(true);
    const response = await apiCall<{ delivery: ClaimDelivery }>("/api/supplier-claims", {
      method: "POST",
      body: { returnId, supplierId: supplier.id, ...(note.trim() ? { agentNote: note.trim() } : {}) },
    });
    setPending(false);
    if (!response.ok) {
      setError(
        response.error.code === "claim_exists"
          ? copy.exists
          : response.status === 403
            ? copy.forbidden
            : response.error.fieldErrors?.returnId === "defect_not_confirmed"
              ? copy.notConfirmed
              : copy.genericError,
      );
      if (response.error.code === "claim_exists") router.refresh();
      return;
    }
    setResult(response.data.delivery);
    router.refresh();
  }

  if (result) {
    return (
      <p role="status" className="text-sm">
        {result === "sent" ? copy.resultSent : result === "not_configured" ? copy.resultDraftNotConfigured : copy.resultDraftFailed}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="claim-supplier">{copy.supplierLabel}</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger id="claim-supplier" aria-invalid={supplierError !== null} className="w-full sm:w-80">
            <SelectValue placeholder={copy.supplierPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((option) => (
              <SelectItem key={option.id} value={String(option.id)}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {supplierError && <ErrorMessage message={supplierError} />}
      </div>

      {supplier && (
        <p className="text-sm">
          <span className="text-muted-foreground">{copy.guidelinesLabel}: </span>
          <span className="whitespace-pre-wrap break-words">{supplier.guidelines ?? copy.noGuidelines}</span>
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="claim-agent-note">{copy.noteLabel}</Label>
        <Textarea id="claim-agent-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {preview && (
        <section aria-labelledby="claim-preview" className="space-y-2 text-sm">
          <h3 id="claim-preview" className="font-medium">
            {copy.previewHeading}
          </h3>
          <p>
            <span className="text-muted-foreground">{copy.previewSubject}: </span>
            {preview.subject}
          </p>
          <pre className="font-sans whitespace-pre-wrap break-words rounded-md bg-muted p-3">{preview.body}</pre>
        </section>
      )}

      {!mailDelivers && (
        <p role="status" className="text-sm text-muted-foreground">
          {copy.notDelivering}
        </p>
      )}
      {error && <ErrorMessage message={error} />}
      <Button type="submit" disabled={pending}>
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
