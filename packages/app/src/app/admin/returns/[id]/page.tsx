import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEventTime, type ReturnDetailView, type ReturnEvent } from "@easyrms/core";
import { Badge, Card, CardContent, CardHeader, CardTitle, Timeline, type TimelineEvent } from "@easyrms/ui/admin";

import { createRequestScope } from "@/server/container";
import { returnsCopy } from "../copy";
import { statusBadgeVariant } from "../status-badge";
import { DecisionActions } from "./decision-actions";

export const dynamic = "force-dynamic";

const copy = returnsCopy.card;

function toTimelineEvent(event: ReturnEvent): TimelineEvent {
  return {
    id: event.id,
    label: event.type === "submitted" ? copy.eventLabels.submitted : returnsCopy.statusLabels[event.toStatus],
    actor: copy.actors[event.actor],
    at: formatEventTime(event.createdAt),
    note: event.note ?? undefined,
  };
}

/**
 * Next bundles `@easyrms/core` once per layer (the container's and the page's), so `instanceof NotFoundError` is false
 * for an error thrown through the container: match on the stable error code instead.
 */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function loadDetail(id: number): Promise<ReturnDetailView> {
  const scope = await createRequestScope();
  try {
    return await scope.cradle.returnService.getDetail(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export default async function ReturnCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) notFound();

  const { request, decisionNote, events } = await loadDetail(id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <Link href="/admin/returns" className="text-sm underline underline-offset-4">
        {copy.back}
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>{request.rma}</CardTitle>
          <Badge variant={statusBadgeVariant[request.status]}>{returnsCopy.statusLabels[request.status]}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{copy.order}</dt>
            <dd>{request.orderNumber}</dd>
            <dt className="text-muted-foreground">{copy.customer}</dt>
            <dd>{request.customerEmail}</dd>
            {request.reason && (
              <>
                <dt className="text-muted-foreground">{copy.reason}</dt>
                <dd className="whitespace-pre-wrap">{request.reason}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{copy.due}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {formatEventTime(request.dueAt)}
              {request.overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
            </dd>
            <dt className="text-muted-foreground">{copy.decisionNote}</dt>
            <dd className="whitespace-pre-wrap">{decisionNote ?? copy.noDecisionNote}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.actions}</CardTitle>
        </CardHeader>
        <CardContent>
          {request.status === "unknown" ? (
            <p className="text-sm text-destructive" role="alert">
              {copy.unknownStatus}
            </p>
          ) : (
            <DecisionActions id={request.id} allowed={request.allowedTransitions} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.timeline}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={events.map(toTimelineEvent)} emptyMessage={copy.timelineEmpty} />
        </CardContent>
      </Card>
    </main>
  );
}
