"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  COMPLAINT_DESCRIPTION_MAX_LENGTH,
  COMPLAINT_RESOLUTIONS,
  COMPLAINT_WIZARD_STEPS,
  RETURN_METHODS,
  checkComplaintWizardStep,
  complaintSubmitSignature,
  firstInvalidComplaintStep,
  needsNewIdempotencyKey,
  refusedLinesFromFieldErrors,
  type ComplaintResolution,
  type ComplaintWizardItemState,
  type ComplaintWizardStep,
  type LookupLineView,
  type ReturnMethod,
  type ReturnQuoteView,
} from "@easyrms/core";
import { apiCall } from "@easyrms/ui/api";
import {
  Banner,
  Field,
  LinePicker,
  MethodStep,
  ResolutionStep,
  SummaryStep,
  TextInput,
  Textarea,
  WizardShell,
  type ResolutionQuoteView,
} from "@easyrms/ui/public";

import { errorMessage } from "../../_lib/error-copy";
import { complaintCopy as copy } from "./copy";

interface SubmitResponse {
  rma: string;
}

type QuoteState = { status: "idle" } | { status: "pending" } | { status: "ready"; quote: ReturnQuoteView } | { status: "error"; text: string };

interface SubmitFailure {
  text: string;
  link?: { href: string; label: string };
}

/** Client island: five steps, server-computed quote, one idempotency key per mount (retries reuse it). */
export function ComplaintWizard({ lines, today, deliveredOn }: { lines: LookupLineView[]; today: string; deliveredOn: string | null }): ReactElement {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [failedSignature, setFailedSignature] = useState<string | null>(null);
  const [step, setStep] = useState<ComplaintWizardStep>("items");
  const [items, setItems] = useState<ComplaintWizardItemState[]>([]);
  const [defectDescription, setDefectDescription] = useState("");
  const [defectDiscoveredOn, setDefectDiscoveredOn] = useState("");
  const [returnMethod, setReturnMethod] = useState<ReturnMethod | null>(null);
  const [resolution, setResolution] = useState<ComplaintResolution | null>(null);
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
  const state = { items, defectDescription, defectDiscoveredOn, returnMethod, resolution, acknowledged };
  const check = checkComplaintWizardStep(step, state, wizardLines, context);
  const stepIndex = COMPLAINT_WIZARD_STEPS.indexOf(step);
  const lineByRef = new Map(lines.map((line) => [line.lineRef, line]));
  const itemRefsKey = items.map((item) => `${item.lineRef}:${item.quantity}`).join(",");

  // The quote is fetched when the resolution step is open; the client shows the server's text and does no money math.
  useEffect(() => {
    if (step !== "resolution" || resolution === null || returnMethod === null || items.length === 0) return;
    const ticket = ++latestQuote.current;
    const body = { kind: "complaint", items: items.map(({ lineRef, quantity }) => ({ lineRef, quantity })), returnMethod, resolution };
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
  }, [step, resolution, returnMethod, itemRefsKey]);

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
    return key ? (copy.ineligible[key] ?? copy.ineligible.not_returnable) : undefined;
  }

  function goNext(): void {
    if (!check.ok) return setShowProblems(true);
    setShowProblems(false);
    setStep(COMPLAINT_WIZARD_STEPS[stepIndex + 1] ?? step);
  }

  function goBack(): void {
    setShowProblems(false);
    setFailure(null);
    setStep(COMPLAINT_WIZARD_STEPS[stepIndex - 1] ?? step);
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    const invalid = firstInvalidComplaintStep(state, wizardLines, context);
    if (invalid !== null) {
      setStep(invalid);
      return setShowProblems(true);
    }
    if (resolution === null || returnMethod === null) return;
    const signature = complaintSubmitSignature(state);
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
        kind: "complaint",
        items: items.map((item) => ({
          lineRef: item.lineRef,
          quantity: item.quantity,
          ...(item.serialNumber.trim() ? { serialNumber: item.serialNumber.trim() } : {}),
        })),
        defectDescription: defectDescription.trim(),
        defectDiscoveredOn,
        resolution,
        returnMethod,
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
                  ? [...current, { lineRef: id, quantity: 1, serialNumber: "" }].sort(
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
    if (step === "defect") {
      return (
        <div className="space-y-5">
          <Field
            label={copy.defect.descriptionLabel}
            hint={`${copy.defect.descriptionHint} ${copy.defect.descriptionCounter(defectDescription.trim().length, COMPLAINT_DESCRIPTION_MAX_LENGTH)}`}
            error={shown((p) => p.problem === "description_too_short" || p.problem === "description_too_long")}
          >
            <Textarea rows={6} value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} />
          </Field>
          <Field
            label={copy.defect.dateLabel}
            hint={copy.defect.dateHint}
            error={shown((p) => p.problem === "date_missing" || p.problem === "date_invalid" || p.problem === "date_future" || p.problem === "date_before_delivery")}
          >
            <TextInput type="date" value={defectDiscoveredOn} max={today} {...(deliveredOn ? { min: deliveredOn } : {})} onChange={(e) => setDefectDiscoveredOn(e.target.value)} />
          </Field>
          {items.map((item) => {
            const name = lineByRef.get(item.lineRef)?.name ?? item.lineRef;
            return (
              <Field
                key={item.lineRef}
                label={copy.defect.serialLabel(name)}
                hint={copy.defect.serialHint}
                error={showProblems && check.problems.some((p) => p.lineRef === item.lineRef && p.problem === "serial_too_long") ? copy.problems.serial_too_long : undefined}
              >
                <TextInput
                  value={item.serialNumber}
                  onChange={(e) => setItems((current) => current.map((i) => (i.lineRef === item.lineRef ? { ...i, serialNumber: e.target.value } : i)))}
                />
              </Field>
            );
          })}
          <Banner tone="info">{copy.defect.photosNote}</Banner>
        </div>
      );
    }
    if (step === "method") {
      return (
        <MethodStep
          legend={copy.method.legend}
          options={RETURN_METHODS.map((m) => ({ value: m, label: copy.method.options[m].label, description: copy.method.options[m].description }))}
          value={returnMethod}
          onChange={(value) => setReturnMethod(value as ReturnMethod)}
          error={shown((p) => p.problem === "method_missing")}
        />
      );
    }
    if (step === "resolution") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{copy.resolution.legalHint}</p>
          <ResolutionStep
            legend={copy.resolution.legend}
            options={COMPLAINT_RESOLUTIONS.map((r) => ({ value: r, label: copy.resolution.options[r].label, description: copy.resolution.options[r].description }))}
            value={resolution}
            onChange={(value) => setResolution(value as ComplaintResolution)}
            error={shown((p) => p.problem === "resolution_missing")}
            quote={quoteView()}
          />
        </div>
      );
    }
    const rows = [
      { label: copy.summary.rows.discoveredOn, value: defectDiscoveredOn },
      { label: copy.summary.rows.method, value: returnMethod ? copy.method.options[returnMethod].label : "" },
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
            reasonText: item.serialNumber.trim() ? `${copy.summary.serialPrefix}: ${item.serialNumber.trim()}` : "",
            comment: `${copy.summary.defectPrefix}: ${defectDescription.trim()}`,
          }))}
          rows={rows}
          acknowledgement={{
            label: copy.summary.acknowledgement,
            checked: acknowledged,
            onChange: setAcknowledged,
            error: shown((p) => p.problem === "acknowledgement_missing"),
          }}
          submit={{ label: failure ? copy.summary.retry : copy.summary.submit, pendingLabel: copy.summary.pending, pending: submitting, onSubmit: () => void submit() }}
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
      title: copy.resolution.quoteTitle[resolution],
      amountLabel: copy.resolution.amountLabel[resolution],
      amountText: quote.quote.amountText,
    };
  }

  return (
    <WizardShell
      steps={COMPLAINT_WIZARD_STEPS.map((id) => ({ id, label: copy.steps[id] }))}
      currentId={step}
      stepperLabel={copy.stepperLabel}
      stepDoneLabel={copy.stepDoneLabel}
      heading={copy.headings[step]}
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
