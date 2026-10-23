import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { formatDatePl, formatEventTime, formatMoney, trackerEventView, trackerView, type ReturnDetailView } from "@easyrms/core";
import { Banner, StageList, Timeline, type Stage } from "@easyrms/ui/public";

import { createRequestScope } from "@/server/container";
import { GUEST_SESSION_COOKIE, getGuestSessionService } from "@/server/guest-session";
import { trackerCopy as copy } from "./copy";

export const dynamic = "force-dynamic";

/** Next bundles `@easyrms/core` once per layer, so match on the stable error code, not `instanceof`. */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function loadDetail(orderNumber: string, rma: string): Promise<ReturnDetailView> {
  const scope = await createRequestScope();
  try {
    // Local data only (S6): the order platform is never called from the tracker.
    return await scope.cradle.returnService.getByRma(orderNumber, rma);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export default async function TrackerPage({ params }: { params: Promise<{ rma: string }> }) {
  const { rma } = await params;
  const cookieStore = await cookies();
  const session = await getGuestSessionService().verify(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (!session) redirect("/returns/lookup");

  // Another order's session gets the same 404 as an unknown RMA: existence is never revealed.
  const { request, decisionNote, items, events } = await loadDetail(session.orderNumber, rma);

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
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/returns" className="text-sm underline underline-offset-4">
          {copy.back}
        </Link>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.confirmation}</p>
        <p className="text-sm">
          {copy.reference}: <strong className="font-mono text-base">{request.rma}</strong>
        </p>
      </header>

      {view.banner === "awaiting_customer" && <Banner tone="warning">{copy.awaitingCustomerBanner}</Banner>}

      <section aria-labelledby="tracker-status" className="space-y-4">
        <h2 id="tracker-status" className="text-lg font-semibold">
          {copy.currentStatus}: {copy.statusLabels[request.status]}
        </h2>
        <StageList stages={stages} closed={closed} label={copy.stagesLabel} />
        {view.showReplyTarget && <p className="text-sm">{copy.replyTarget}</p>}
      </section>

      <section aria-labelledby="tracker-what-now" className="space-y-2">
        <h2 id="tracker-what-now" className="text-lg font-semibold">
          {copy.whatNowHeading}
        </h2>
        <p className="text-sm">{copy.whatNow[view.whatNow]}</p>
      </section>

      <section aria-labelledby="tracker-summary" className="space-y-3">
        <h2 id="tracker-summary" className="text-lg font-semibold">
          {copy.summaryHeading}
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
                <span className="break-words">{item.name}</span>
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
    </main>
  );
}
