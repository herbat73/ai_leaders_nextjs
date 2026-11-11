"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  COMPLAINT_DESCRIPTION_MAX_LENGTH,
  DAMAGE_WIZARD_STEPS,
  MISSING_REASON_CODES,
  EVIDENCE_CONTENT_TYPES,
  MISSING_RESOLUTIONS,
  TRANSPORT_RESOLUTIONS,
  checkDamageWizardStep,
  damageSubmitSignature,
  firstInvalidDamageStep,
  needsNewIdempotencyKey,
  refusedLinesFromFieldErrors,
  type DamageKind,
  type DamageResolution,
  type DamageWizardItemState,
  type DamageWizardStep,
  type LookupLineView,
  type MissingReasonCode,
  type ReturnQuoteView,
} from "@easyrms/core";
import { apiCall } from "@easyrms/ui/api";
import {
  Banner,
  Field,
  LinePicker,
  PhotoPicker,
  type PhotoItem,
  MethodStep,
  ResolutionStep,
  SummaryStep,
  TextInput,
  Textarea,
  WizardShell,
  type ResolutionQuoteView,
} from "@easyrms/ui/public";

import { errorMessage } from "../_lib/error-copy";
import { damageCopy as copy } from "./copy";

interface SubmitResponse {
  rma: string;
}

type QuoteState = { status: "idle" } | { status: "pending" } | { status: "ready"; quote: ReturnQuoteView } | { status: "error"; text: string };

interface SubmitFailure {
  text: string;
  link?: { href: string; label: string };
}

type CourierAnswer = "yes" | "no" | "unknown";

/** One file the customer picked: its own upload state; `evidenceId` is set once the server has stored it. */
interface Photo {
  key: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  /** Language-neutral reason, mapped to Polish by `copy.photos.errors`. */
  errorKey?: keyof typeof copy.photos.errors;
  evidenceId?: string;
}

interface UploadResponse {
  id: string;
}

const MB = 1024 * 1024;
const sizeText = (bytes: number): string => `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;

/** Maps an upload failure to a copy key: the code is stable, the server message is never shown. */
function uploadErrorKey(code: string, status: number): keyof typeof copy.photos.errors {
  switch (code) {
    case "scanner_unavailable":
      return "scanner_unavailable";
    case "too_large":
    case "payload_too_large":
      return "too_large";
    case "not_an_image":
      return "not_an_image";
    case "rejected":
      return "rejected";
    case "quota_exceeded":
      return "quota_exceeded";
    case "rate_limited":
      return "rate_limited";
    case "unauthorized":
      return "unauthorized";
    default:
      return status === 0 ? "network" : "unknown";
  }
}

const COURIER_VALUES: Record<CourierAnswer, boolean | null> = { yes: true, no: false, unknown: null };

/**
 * Client island for transport damage and missing items: four steps (photos join later), server-computed quote, one
 * idempotency key per mount (retries reuse it). No return method: neither kind sends the goods back.
 */
export function DamageWizard({
  kind,
  lines,
  today,
  deliveredOn,
  windowDays,
  maxFiles,
  maxFileMb,
}: {
  kind: DamageKind;
  lines: LookupLineView[];
  today: string;
  deliveredOn: string | null;
  windowDays: number;
  /** Photos per report and megabytes per photo, from the server configuration (Q4). */
  maxFiles: number;
  maxFileMb: number;
}): ReactElement {
  const kindCopy = copy.kinds[kind];
  const resolutions: readonly DamageResolution[] = kind === "transport" ? TRANSPORT_RESOLUTIONS : MISSING_RESOLUTIONS;
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [failedSignature, setFailedSignature] = useState<string | null>(null);
  const [step, setStep] = useState<DamageWizardStep>("items");
  const [items, setItems] = useState<DamageWizardItemState[]>([]);
  const [defectDescription, setDefectDescription] = useState("");
  const [defectDiscoveredOn, setDefectDiscoveredOn] = useState("");
  const [courierAnswer, setCourierAnswer] = useState<CourierAnswer | null>(null);
  const [reasonCode, setReasonCode] = useState<MissingReasonCode>("missing_element");
  const [resolution, setResolution] = useState<DamageResolution | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [refused, setRefused] = useState<Record<string, string>>({});
  const latestQuote = useRef(0);

  const wizardLines = useMemo(
    () => lines.map((line) => ({ lineRef: line.lineRef, remainingQuantity: line.remainingQuantity, eligible: line.eligible && !refused[line.lineRef] })),
    [lines, refused],
  );
  const context = { today, deliveredOn };
  const state = {
    kind,
    items: items.map((item) => ({ ...item, reasonCode })),
    defectDescription,
    defectDiscoveredOn,
    courierNote: courierAnswer === null ? null : COURIER_VALUES[courierAnswer],
    evidenceFileIds: photos.flatMap((photo) => (photo.status === "done" && photo.evidenceId ? [photo.evidenceId] : [])),
    resolution,
    acknowledged,
  };
  const check = checkDamageWizardStep(step, state, wizardLines, context);
  const stepIndex = DAMAGE_WIZARD_STEPS.indexOf(step);
  const lineByRef = new Map(lines.map((line) => [line.lineRef, line]));
  const itemRefsKey = items.map((item) => `${item.lineRef}:${item.quantity}`).join(",");

  // The quote is fetched when the resolution step is open; the client shows the server's text and does no money math.
  useEffect(() => {
    if (step !== "resolution" || resolution === null || items.length === 0) return;
    const ticket = ++latestQuote.current;
    const body = { kind, items: items.map(({ lineRef, quantity }) => ({ lineRef, quantity })), resolution };
    void (async () => {
      setQuote({ status: "pending" });
      const result = await apiCall<ReturnQuoteView>("/api/returns/quote", { method: "POST", body });
      if (ticket !== latestQuote.current) return;
      if (result.ok) return setQuote({ status: "ready", quote: result.data });
      const { key, message } = errorMessage(result.error, result.status);
      if (key === "validation_error" && result.error.fieldErrors) {
        applyRefused(result.error.fieldErrors);
        return setQuote({ status: "error", text: copy.resolution.quoteLinesChanged });
      }
      setQuote({ status: "error", text: message });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` is tracked through `itemRefsKey`
  }, [step, resolution, itemRefsKey]);

  function applyRefused(fieldErrors: Record<string, string>): boolean {
    const next = refusedLinesFromFieldErrors(fieldErrors);
    if (Object.keys(next).length === 0) return false;
    setRefused((current) => ({ ...current, ...next }));
    setItems((current) => current.filter((item) => !next[item.lineRef]));
    setShowProblems(false);
    setStep("items");
    return true;
  }

  function reasonText(line: LookupLineView): string | undefined {
    const key = (refused[line.lineRef] ?? line.ineligibleReason) as keyof typeof copy.ineligible | undefined;
    return key ? (copy.ineligible[key] ?? copy.ineligible.not_returnable)(windowDays) : undefined;
  }

  const uploading = photos.some((photo) => photo.status === "uploading");

  /** Uploads one file at a time, in the order picked, so the per-order limits are met in a predictable order. */
  async function uploadAll(batch: { photo: Photo; file: File }[]): Promise<void> {
    for (const { photo, file } of batch) {
      const form = new FormData();
      form.append("file", file, file.name);
      const result = await apiCall<UploadResponse>("/api/evidence", { method: "POST", body: form });
      setPhotos((current) =>
        current.map((candidate) =>
          candidate.key !== photo.key
            ? candidate
            : result.ok
              ? { ...candidate, status: "done", evidenceId: result.data.id }
              : { ...candidate, status: "error", errorKey: uploadErrorKey(result.error.code, result.status) },
        ),
      );
    }
  }

  function addPhotos(files: File[]): void {
    const room = Math.max(0, maxFiles - photos.length);
    const picked = files.slice(0, room);
    const batch: { photo: Photo; file: File }[] = [];
    const added: Photo[] = picked.map((file) => {
      const photo: Photo = { key: crypto.randomUUID(), name: file.name, size: file.size, status: "uploading" };
      const type = (EVIDENCE_CONTENT_TYPES as readonly string[]).includes(file.type);
      // Cheap checks first, so an obvious mistake never leaves the browser; the server checks the content again.
      if (!type) return { ...photo, status: "error", errorKey: "not_an_image" };
      if (file.size > maxFileMb * MB) return { ...photo, status: "error", errorKey: "too_large" };
      batch.push({ photo, file });
      return photo;
    });
    setPhotos((current) => [...current, ...added]);
    setShowProblems(false);
    void uploadAll(batch);
  }

  function removePhoto(key: string): void {
    const photo = photos.find((candidate) => candidate.key === key);
    setPhotos((current) => current.filter((candidate) => candidate.key !== key));
    // Best effort: a file that stays staged is deleted by the server once it is older than the session.
    if (photo?.evidenceId) void apiCall(`/api/evidence/${photo.evidenceId}`, { method: "DELETE" });
  }

  function goNext(): void {
    if (step === "photos" && uploading) return setFailure({ text: copy.photos.waitForUploads });
    setFailure(null);
    if (!check.ok) return setShowProblems(true);
    setShowProblems(false);
    setStep(DAMAGE_WIZARD_STEPS[stepIndex + 1] ?? step);
  }

  function goBack(): void {
    setShowProblems(false);
    setFailure(null);
    setStep(DAMAGE_WIZARD_STEPS[stepIndex - 1] ?? step);
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    if (uploading) return setFailure({ text: copy.photos.waitForUploads });
    const invalid = firstInvalidDamageStep(state, wizardLines, context);
    if (invalid !== null) {
      setStep(invalid);
      return setShowProblems(true);
    }
    if (resolution === null) return;
    const signature = damageSubmitSignature(state);
    let key = idempotencyKey;
    if (needsNewIdempotencyKey(failedSignature, signature)) {
      key = crypto.randomUUID();
      setIdempotencyKey(key);
    }
    setFailedSignature(signature);
    setSubmitting(true);
    setFailure(null);
    const result = await apiCall<SubmitResponse>("/api/returns", {
      method: "POST",
      body: {
        kind,
        items: items.map((item) => ({
          lineRef: item.lineRef,
          quantity: item.quantity,
          ...(kind === "missing" ? { reasonCode } : {}),
        })),
        defectDescription: defectDescription.trim(),
        defectDiscoveredOn,
        ...(kind === "transport" && courierAnswer !== null && COURIER_VALUES[courierAnswer] !== null ? { courierNote: COURIER_VALUES[courierAnswer] } : {}),
        evidenceFileIds: state.evidenceFileIds,
        resolution,
        acknowledged: true,
        idempotencyKey: key,
      },
    });
    if (result.ok) {
      router.push(`/returns/${result.data.rma}`);
      return;
    }
    setSubmitting(false);
    if (result.error.code === "conflict") {
      if (result.error.fieldErrors && applyRefused(result.error.fieldErrors)) return setFailure({ text: copy.linesChanged });
      return setFailure({ text: copy.conflict, link: { href: "/returns", label: copy.conflictLink } });
    }
    const { key: errorKey, message } = errorMessage(result.error, result.status);
    if (errorKey === "unauthorized") return setFailure({ text: message, link: { href: "/", label: copy.sessionLink } });
    if (errorKey === "validation_error" && result.error.fieldErrors?.evidenceFileIds) {
      // A photo the server no longer accepts (removed, expired, or not this order's): back to the photos step.
      setStep("photos");
      return setFailure({ text: copy.photos.refusedOnSubmit });
    }
    if (errorKey === "validation_error" && result.error.fieldErrors) {
      if (applyRefused(result.error.fieldErrors)) return setFailure({ text: copy.linesChanged });
      return setFailure({ text: copy.fieldErrors });
    }
    setFailure({ text: message });
  }

  const shown = (predicate: (p: (typeof check.problems)[number]) => boolean): string | undefined => {
    const hit = showProblems ? check.problems.find(predicate) : undefined;
    return hit ? copy.problems[hit.problem] : undefined;
  };

  function renderStep(): ReactElement {
    if (step === "items") {
      return (
        <div className="space-y-4">
          {failure && <Banner tone="error">{failure.text}</Banner>}
          {lines.every((line) => !line.eligible) && <Banner tone="info">{copy.noLines}</Banner>}
          <LinePicker
            legend={copy.items.legend}
            decreaseLabel={copy.items.decrease}
            increaseLabel={copy.items.increase}
            lines={lines.map((line) => {
              const item = items.find((i) => i.lineRef === line.lineRef);
              return {
                id: line.lineRef,
                title: line.name,
                detail: `${copy.items.unitPrice} ${line.unitPriceText}`,
                remainingQuantity: line.remainingQuantity,
                eligible: line.eligible && !refused[line.lineRef],
                ineligibleReason: reasonText(line),
                selected: item !== undefined,
                quantity: item?.quantity ?? 1,
                capText: copy.items.capText(line.remainingQuantity),
                quantityLabel: copy.items.quantityLabel(line.name),
              };
            })}
            onToggle={(id, selected) =>
              setItems((current) =>
                selected
                  ? [...current, { lineRef: id, quantity: 1, reasonCode: "missing_element" as const }].sort(
                      (a, b) => lines.findIndex((l) => l.lineRef === a.lineRef) - lines.findIndex((l) => l.lineRef === b.lineRef),
                    )
                  : current.filter((item) => item.lineRef !== id),
              )
            }
            onQuantityChange={(id, quantity) => setItems((current) => current.map((item) => (item.lineRef === id ? { ...item, quantity } : item)))}
            error={shown((p) => p.problem === "no_items" || p.problem === "quantity" || p.problem === "ineligible")}
          />
        </div>
      );
    }
    if (step === "details") {
      return (
        <div className="space-y-5">
          <Field
            label={kindCopy.descriptionLabel}
            hint={`${kindCopy.descriptionHint} ${copy.details.descriptionCounter(defectDescription.trim().length, COMPLAINT_DESCRIPTION_MAX_LENGTH)}`}
            error={shown((p) => p.problem === "description_too_short" || p.problem === "description_too_long")}
          >
            <Textarea rows={6} value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} />
          </Field>
          <Field
            label={kindCopy.dateLabel}
            hint={copy.details.dateHint}
            error={shown((p) => p.problem === "date_missing" || p.problem === "date_invalid" || p.problem === "date_future" || p.problem === "date_before_delivery")}
          >
            <TextInput type="date" value={defectDiscoveredOn} max={today} {...(deliveredOn ? { min: deliveredOn } : {})} onChange={(e) => setDefectDiscoveredOn(e.target.value)} />
          </Field>
          {kind === "transport" && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{copy.details.courierHint}</p>
              <MethodStep
                legend={copy.details.courierLegend}
                options={(Object.keys(copy.details.courierOptions) as CourierAnswer[]).map((value) => ({
                  value,
                  label: copy.details.courierOptions[value].label,
                  description: copy.details.courierOptions[value].description,
                }))}
                value={courierAnswer}
                onChange={(value) => setCourierAnswer(value as CourierAnswer)}
              />
            </div>
          )}
          {kind === "missing" && (
            <MethodStep
              legend={copy.details.reasonLegend}
              options={MISSING_REASON_CODES.map((code) => ({
                value: code,
                label: copy.details.reasonOptions[code].label,
                description: copy.details.reasonOptions[code].description,
              }))}
              value={reasonCode}
              onChange={(value) => setReasonCode(value as MissingReasonCode)}
            />
          )}
        </div>
      );
    }
    if (step === "photos") {
      const items: PhotoItem[] = photos.map((photo) => ({
        id: photo.key,
        name: photo.name,
        sizeText: sizeText(photo.size),
        status: photo.status,
        statusText: photo.status === "uploading" ? copy.photos.uploading : photo.status === "done" ? copy.photos.done : copy.photos.errors[photo.errorKey ?? "unknown"](maxFileMb),
        ...(photo.status === "done" && photo.evidenceId ? { previewUrl: `/api/evidence/${photo.evidenceId}` } : {}),
      }));
      const full = photos.length >= maxFiles;
      return (
        <div className="space-y-4">
          {failure && <Banner tone="error">{failure.text}</Banner>}
          <PhotoPicker
            legend={copy.photos.legend}
            hint={kind === "transport" ? copy.photos.hintTransport : copy.photos.hintMissing}
            addLabel={copy.photos.add}
            accept={EVIDENCE_CONTENT_TYPES.join(",")}
            items={items}
            counterText={copy.photos.counter(state.evidenceFileIds.length, maxFiles, maxFileMb)}
            removeText={copy.photos.remove}
            removeLabel={copy.photos.removeLabel}
            onAdd={addPhotos}
            onRemove={removePhoto}
            disabled={full}
            disabledText={copy.photos.limitReached(maxFiles)}
            error={shown((p) => p.problem === "photos_missing" || p.problem === "photos_too_many")}
          />
        </div>
      );
    }
    if (step === "resolution") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{copy.resolution.noReturnHint}</p>
          <ResolutionStep
            legend={copy.resolution.legend}
            options={resolutions.map((r) => ({ value: r, label: copy.resolution.options[r].label, description: copy.resolution.options[r].description }))}
            value={resolution}
            onChange={(value) => setResolution(value as DamageResolution)}
            error={shown((p) => p.problem === "resolution_missing")}
            quote={quoteView()}
          />
        </div>
      );
    }
    const rows = [
      { label: kindCopy.summaryDate, value: defectDiscoveredOn },
      ...(kind === "missing" ? [{ label: copy.summary.rows.reason, value: copy.details.reasonOptions[reasonCode].label }] : []),
      ...(kind === "transport" && courierAnswer !== null && COURIER_VALUES[courierAnswer] !== null
        ? [{ label: copy.summary.rows.courierNote, value: copy.summary.courierAnswers[String(COURIER_VALUES[courierAnswer]) as "true" | "false"] }]
        : []),
      { label: copy.summary.rows.photos, value: copy.summary.photoCount(state.evidenceFileIds.length) },
      { label: copy.summary.rows.resolution, value: resolution ? copy.resolution.options[resolution].label : "" },
      ...(quote.status === "ready" && quote.quote.amountText ? [{ label: copy.summary.rows.amount, value: quote.quote.amountText }] : []),
    ];
    return (
      <div className="space-y-4">
        <SummaryStep
          itemsHeading={copy.summary.itemsHeading}
          items={items.map((item) => ({
            title: lineByRef.get(item.lineRef)?.name ?? item.lineRef,
            quantityText: copy.summary.quantity(item.quantity),
            reasonText: "",
            comment: `${kindCopy.summaryDefect}: ${defectDescription.trim()}`,
          }))}
          rows={rows}
          acknowledgement={{
            label: kindCopy.acknowledgement,
            checked: acknowledged,
            onChange: setAcknowledged,
            error: shown((p) => p.problem === "acknowledgement_missing"),
          }}
          submit={{ label: failure ? copy.summary.retry : kindCopy.submit, pendingLabel: copy.summary.pending, pending: submitting, onSubmit: () => void submit() }}
          errorText={failure?.text}
        />
        {failure?.link && (
          <Link href={failure.link.href} className="inline-block text-sm underline underline-offset-4">
            {failure.link.label}
          </Link>
        )}
      </div>
    );
  }

  function quoteView(): ResolutionQuoteView {
    if (quote.status === "idle" || resolution === null) return { status: "idle" };
    if (quote.status === "pending") return { status: "pending", pendingText: copy.resolution.quotePending };
    if (quote.status === "error") return { status: "error", errorText: quote.text };
    if (resolution !== "refund" || quote.quote.amountText === null) return { status: "idle" };
    return {
      status: "ready",
      title: copy.resolution.quoteTitle,
      amountLabel: copy.resolution.amountLabel,
      amountText: quote.quote.amountText,
    };
  }

  return (
    <WizardShell
      steps={DAMAGE_WIZARD_STEPS.map((id) => ({ id, label: copy.steps[id] }))}
      currentId={step}
      stepperLabel={copy.stepperLabel}
      stepDoneLabel={copy.stepDoneLabel}
      heading={step === "items" ? kindCopy.itemsHeading : step === "details" ? kindCopy.detailsHeading : step === "photos" ? copy.photos.heading : step === "resolution" ? copy.resolution.legend : kindCopy.summaryHeading}
      focusKey={step}
      backLabel={copy.backButton}
      nextLabel={copy.nextButton}
      showBack={stepIndex > 0}
      showNext={step !== "summary"}
      backDisabled={submitting}
      onBack={goBack}
      onNext={goNext}
    >
      {renderStep()}
    </WizardShell>
  );
}
