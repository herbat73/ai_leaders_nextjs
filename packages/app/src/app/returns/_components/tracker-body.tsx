import { formatDatePl, formatEventTime, formatMoney, trackerEventView, trackerView, type ReturnDetailView } from "@easyrms/core";
import { Banner, StageList, Timeline, type Stage } from "@easyrms/ui/public";
import type { ReactElement } from "react";

import { complaintTrackerCopy, trackerCopy as copy } from "./tracker-copy";

/**
 * The customer-facing tracker sections (status, what now, summary, items, timeline) for one return. Shared by the
 * customer page and the agents' read-only preview, so what the agent previews is exactly what the customer sees: it
 * is built only from `trackerView` and `trackerEventView`, has no links or actions, and never shows who decided.
 */
export function TrackerBody({ detail }: { detail: ReturnDetailView }): ReactElement {
  const { request, decisionNote, items, events } = detail;
  const complaint = request.kind === "complaint";
  const kindCopy = complaint
    ? complaintTrackerCopy
    : { stagesLabel: copy.stagesLabel, summaryHeading: copy.summaryHeading, whatNow: copy.whatNow };
  const view = trackerView(request.status);
  const stages: Stage[] = view.stages.map((stage) => ({ id: stage.id, label: copy.stages[stage.id], state: stage.state }));
  const closed = view.closed
    ? { label: copy.closed[view.closed.kind], reason: view.closed.kind === "rejected" ? (decisionNote ?? undefined) : undefined }
    : undefined;
  const timeline = events.map(trackerEventView).map((event) => ({
    id: event.id,
    label: copy.events[event.key],
    actor: copy.actors[event.actor],
    at: formatEventTime(event.at),
    note: event.note ?? undefined,
  }));

  return (
    <>
      {view.banner === "awaiting_customer" && <Banner tone="warning">{copy.awaitingCustomerBanner}</Banner>}

      <section aria-labelledby="tracker-status" className="space-y-4">
        <h2 id="tracker-status" className="text-lg font-semibold">
          {copy.currentStatus}: {copy.statusLabels[request.status]}
        </h2>
        <StageList stages={stages} closed={closed} label={kindCopy.stagesLabel} />
        {view.showReplyTarget && <p className="text-sm">{copy.replyTarget}</p>}
      </section>

      <section aria-labelledby="tracker-what-now" className="space-y-2">
        <h2 id="tracker-what-now" className="text-lg font-semibold">
          {copy.whatNowHeading}
        </h2>
        <p className="text-sm">{kindCopy.whatNow[view.whatNow]}</p>
      </section>

      <section aria-labelledby="tracker-summary" className="space-y-3">
        <h2 id="tracker-summary" className="text-lg font-semibold">
          {kindCopy.summaryHeading}
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
          <dt className="text-muted-foreground">{copy.submittedOn}</dt>
          <dd>{formatDatePl(request.createdAt)}</dd>
          {request.resolution && (
            <>
              <dt className="text-muted-foreground">{copy.resolutionLabel}</dt>
              <dd>{copy.resolutions[request.resolution]}</dd>
              {request.resolution === "exchange" ? (
                request.exchangeNote && (
                  <>
                    <dt className="text-muted-foreground">{copy.exchangeNoteLabel}</dt>
                    <dd className="whitespace-pre-wrap break-words">{request.exchangeNote}</dd>
                  </>
                )
              ) : (
                request.resolutionAmount && (
                  <>
                    <dt className="text-muted-foreground">{copy.amountLabel}</dt>
                    <dd>{formatMoney(request.resolutionAmount)}</dd>
                  </>
                )
              )}
            </>
          )}
          {request.returnMethod && (
            <>
              <dt className="text-muted-foreground">{copy.methodLabel}</dt>
              <dd>{copy.methods[request.returnMethod]}</dd>
            </>
          )}
          {complaint && request.defectDiscoveredOn && (
            <>
              <dt className="text-muted-foreground">{complaintTrackerCopy.discoveredOnLabel}</dt>
              <dd>{formatDatePl(new Date(`${request.defectDiscoveredOn}T12:00:00Z`))}</dd>
            </>
          )}
          {complaint && request.defectDescription && (
            <>
              <dt className="text-muted-foreground">{complaintTrackerCopy.defectLabel}</dt>
              <dd className="whitespace-pre-wrap break-words">{request.defectDescription}</dd>
            </>
          )}
        </dl>
      </section>

      {items.length > 0 && (
        <section aria-labelledby="tracker-items" className="space-y-3">
          <h2 id="tracker-items" className="text-lg font-semibold">
            {copy.itemsHeading}
          </h2>
          <ul className="space-y-1 text-sm">
            {items.map((item) => (
              <li key={item.lineRef} className="flex justify-between gap-4">
                <span className="break-words">
                  {item.name}
                  {item.serialNumber && (
                    <span className="block text-muted-foreground">
                      {complaintTrackerCopy.serialLabel}: {item.serialNumber}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">{copy.itemQuantity(item.quantity)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tracker-timeline" className="space-y-3">
        <h2 id="tracker-timeline" className="text-lg font-semibold">
          {copy.timelineHeading}
        </h2>
        <Timeline events={timeline} emptyMessage={copy.timelineEmpty} />
      </section>
    </>
  );
}
