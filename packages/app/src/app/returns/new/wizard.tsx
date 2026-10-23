"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  RETURN_METHODS,
  RETURN_REASON_CODES,
  RETURN_RESOLUTIONS,
  MAX_ITEM_COMMENT_LENGTH,
  WIZARD_STEPS,
  checkWizardStep,
  type LookupLineView,
  type ReturnMethod,
  type ReturnQuoteView,
  type ReturnReasonCode,
  type ReturnResolution,
  type WizardItemState,
  type WizardStep,
} from "@easyrms/core";
import { apiCall } from "@easyrms/ui/admin";
import {
  Banner,
  LinePicker,
  MethodStep,
  ReasonsStep,
  ResolutionStep,
  SummaryStep,
  WizardShell,
  type ResolutionQuoteView,
} from "@easyrms/ui/public";

import { errorMessage } from "../_lib/error-copy";
import { wizardCopy as copy } from "./copy";

interface SubmitResponse {
  rma: string;
}

type QuoteState = { status: "idle" } | { status: "pending" } | { status: "ready"; quote: ReturnQuoteView } | { status: "error"; text: string };

interface SubmitFailure {
  text: string;
  /** Link shown under the banner (new session, list of requests). */
  link?: { href: string; label: string };
}

/** Client island: five steps, server-computed quote, one idempotency key per mount (retries reuse it). */
export function Wizard({ lines }: { lines: LookupLineView[] }): ReactElement {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<WizardStep>("items");
  const [items, setItems] = useState<WizardItemState[]>([]);
  const [returnMethod, setReturnMethod] = useState<ReturnMethod | null>(null);
  const [resolution, setResolution] = useState<ReturnResolution | null>(null);
  const [exchangeNote, setExchangeNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  /** Lines the server refused (quote or submit): shown disabled with the reason, deselected. */
  const [refused, setRefused] = useState<Record<string, string>>({});
  const latestQuote = useRef(0);

  const wizardLines = useMemo(
    () => lines.map((line) => ({ lineRef: line.lineRef, remainingQuantity: line.remainingQuantity, eligible: line.eligible && !refused[line.lineRef] })),
    [lines, refused],
  );
  const state = { items, returnMethod, resolution, exchangeNote, acknowledged };
  const check = checkWizardStep(step, state, wizardLines);
  const stepIndex = WIZARD_STEPS.indexOf(step);
  const lineByRef = new Map(lines.map((line) => [line.lineRef, line]));
  const itemRefsKey = items.map((item) => `${item.lineRef}:${item.quantity}`).join(",");

  // The quote is fetched when the resolution step is open and whenever method, resolution or items change. The client
  // shows `amountText`/`feeText` verbatim and does no money math.
  useEffect(() => {
    if (step !== "resolution" || resolution === null || returnMethod === null || items.length === 0) return;
    const ticket = ++latestQuote.current;
    const body = { items: items.map(({ lineRef, quantity }) => ({ lineRef, quantity })), returnMethod, resolution };
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
    const next: Record<string, string> = {};
    for (const [field, reason] of Object.entries(fieldErrors)) {
      if (field.startsWith("items.")) next[field.slice("items.".length)] = reason;
    }
    const refs = Object.keys(next);
    if (refs.length === 0) return false;
    setRefused((current) => ({ ...current, ...next }));
    setItems((current) => current.filter((item) => !next[item.lineRef]));
    return true;
  }

  function reasonText(line: LookupLineView): string | undefined {
    const refusedReason = refused[line.lineRef];
    const key = (refusedReason ?? line.ineligibleReason) as keyof typeof copy.ineligible | undefined;
    return key ? (copy.ineligible[key] ?? copy.ineligible.not_returnable) : undefined;
  }

  function goNext(): void {
    if (!check.ok) return setShowProblems(true);
    setShowProblems(false);
    setStep(WIZARD_STEPS[stepIndex + 1] ?? step);
  }

  function goBack(): void {
    setShowProblems(false);
    setFailure(null);
    setStep(WIZARD_STEPS[stepIndex - 1] ?? step);
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    if (!check.ok) return setShowProblems(true);
    if (resolution === null || returnMethod === null) return;
    setSubmitting(true);
    setFailure(null);
    const result = await apiCall<SubmitResponse>("/api/returns", {
      method: "POST",
      body: {
        items: items.flatMap((item) =>
          item.reasonCode === null
            ? []
            : [{ lineRef: item.lineRef, quantity: item.quantity, reasonCode: item.reasonCode, ...(item.comment.trim() ? { comment: item.comment.trim() } : {}) }],
        ),
        resolution,
        ...(resolution === "exchange" ? { exchangeNote: exchangeNote.trim() } : {}),
        returnMethod,
        acknowledged: true,
        idempotencyKey,
      },
    });
    if (result.ok) {
      router.push(`/returns/${result.data.rma}`);
      return;
    }
    setSubmitting(false);
    if (result.error.code === "conflict") return setFailure({ text: copy.conflict, link: { href: "/returns", label: copy.conflictLink } });
    const { key, message } = errorMessage(result.error, result.status);
    if (key === "unauthorized") return setFailure({ text: message, link: { href: "/", label: copy.sessionLink } });
    if (key === "validation_error" && result.error.fieldErrors) {
      if (applyRefused(result.error.fieldErrors)) {
        setStep("items");
        return setFailure({ text: copy.linesChanged });
      }
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
                  ? [...current, { lineRef: id, quantity: 1, reasonCode: null, comment: "" }].sort(
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
    if (step === "reasons") {
      return (
        <ReasonsStep
          reasonOptions={RETURN_REASON_CODES.map((code) => ({ value: code, label: copy.reasons.options[code] }))}
          maxCommentLength={MAX_ITEM_COMMENT_LENGTH}
          items={items.map((item) => {
            const name = lineByRef.get(item.lineRef)?.name ?? item.lineRef;
            return {
              lineId: item.lineRef,
              title: name,
              reason: item.reasonCode,
              comment: item.comment,
              reasonLegend: copy.reasons.legend(name),
              commentLabel: copy.reasons.commentLabel,
              commentHint: copy.reasons.commentHint,
              counterText: copy.reasons.counter(item.comment.length, MAX_ITEM_COMMENT_LENGTH),
              reasonError: showProblems && check.problems.some((p) => p.lineRef === item.lineRef && p.problem === "reason_missing") ? copy.problems.reason_missing : undefined,
              commentError: showProblems && check.problems.some((p) => p.lineRef === item.lineRef && p.problem === "comment_too_long") ? copy.problems.comment_too_long : undefined,
            };
          })}
          onReasonChange={(lineId, reason) => setItems((current) => current.map((i) => (i.lineRef === lineId ? { ...i, reasonCode: reason as ReturnReasonCode } : i)))}
          onCommentChange={(lineId, comment) => setItems((current) => current.map((i) => (i.lineRef === lineId ? { ...i, comment } : i)))}
        />
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
        <ResolutionStep
          legend={copy.resolution.legend}
          options={RETURN_RESOLUTIONS.map((r) => ({ value: r, label: copy.resolution.options[r].label, description: copy.resolution.options[r].description }))}
          value={resolution}
          onChange={(value) => setResolution(value as ReturnResolution)}
          error={shown((p) => p.problem === "resolution_missing")}
          quote={quoteView()}
          exchange={
            resolution === "exchange"
              ? {
                  label: copy.resolution.exchangeLabel,
                  hint: copy.resolution.exchangeHint,
                  value: exchangeNote,
                  onChange: setExchangeNote,
                  error: shown((p) => p.problem === "exchange_note_missing" || p.problem === "exchange_note_too_long"),
                }
              : undefined
          }
        />
      );
    }
    const rows = [
      { label: copy.summary.rows.method, value: returnMethod ? copy.method.options[returnMethod].label : "" },
      { label: copy.summary.rows.resolution, value: resolution ? copy.resolution.options[resolution].label : "" },
      ...(resolution === "exchange" ? [{ label: copy.summary.rows.exchange, value: exchangeNote.trim() }] : []),
      ...(quote.status === "ready" && quote.quote.amountText ? [{ label: copy.summary.rows.amount, value: quote.quote.amountText }] : []),
      ...(quote.status === "ready" && quote.quote.feeText ? [{ label: copy.summary.rows.fee, value: quote.quote.feeText }] : []),
    ];
    return (
      <div className="space-y-4">
        <SummaryStep
          itemsHeading={copy.summary.itemsHeading}
          items={items.map((item) => ({
            title: lineByRef.get(item.lineRef)?.name ?? item.lineRef,
            quantityText: copy.summary.quantity(item.quantity),
            reasonText: `${copy.summary.reasonPrefix}: ${item.reasonCode ? copy.reasons.options[item.reasonCode] : ""}`,
            comment: item.comment.trim() || undefined,
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
    if (resolution === "exchange" || quote.quote.amountText === null) return { status: "idle" };
    return {
      status: "ready",
      title: copy.resolution.quoteTitle[resolution],
      amountLabel: copy.resolution.amountLabel[resolution],
      amountText: quote.quote.amountText,
      ...(quote.quote.feeText ? { feeLabel: copy.resolution.feeLabel, feeText: quote.quote.feeText } : {}),
    };
  }

  return (
    <WizardShell
      steps={WIZARD_STEPS.map((id) => ({ id, label: copy.steps[id] }))}
      currentId={step}
      stepperLabel={copy.stepperLabel}
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
