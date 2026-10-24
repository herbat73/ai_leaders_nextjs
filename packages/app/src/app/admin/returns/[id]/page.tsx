import Link from "next/link";
import { notFound } from "next/navigation";
import { approvalBlockedFor, formatEventTime, formatMoney, type ReturnDetailView, type ReturnEvent } from "@easyrms/core";
import { Badge, Card, CardContent, CardHeader, CardTitle, Timeline, type TimelineEvent } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { getApprovalConfig } from "@/server/return-config";
import { AdminShell } from "../../_shell/admin-shell";
import { returnsCopy } from "../copy";
import { statusBadgeVariant } from "../status-badge";
import { DecisionActions } from "./decision-actions";

export const dynamic = "force-dynamic";

const copy = returnsCopy.card;

function toTimelineEvent(event: ReturnEvent): TimelineEvent {
  return {
    id: event.id,
    label: event.type === "submitted" ? copy.eventLabels.submitted : returnsCopy.statusLabels[event.toStatus],
    // The named agent for a decision made after login; legacy agent events (no identity recorded) keep the generic label.
    actor: event.agentName ?? copy.actors[event.actor],
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
  const agent = await requireAgentPage(`/admin/returns/${rawId}`);
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) notFound();

  const { request, decisionNote, items, events } = await loadDetail(id);

  return (
    <AdminShell agent={agent}>
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
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
              <dt className="text-muted-foreground">{copy.order}</dt>
              <dd className="break-words">{request.orderNumber}</dd>
              <dt className="text-muted-foreground">{copy.customer}</dt>
              <dd className="break-words">{request.customerEmail}</dd>
              {(items.length === 0 || request.reason !== null) && (
                <>
                  <dt className="text-muted-foreground">{copy.reason}</dt>
                  <dd className="whitespace-pre-wrap break-words">{request.reason ?? "—"}</dd>
                </>
              )}
              {request.resolution && (
                <>
                  <dt className="text-muted-foreground">{copy.resolution}</dt>
                  <dd>{copy.resolutions[request.resolution]}</dd>
                  {request.resolution === "exchange" ? (
                    request.exchangeNote && (
                      <>
                        <dt className="text-muted-foreground">{copy.exchangeNote}</dt>
                        <dd className="whitespace-pre-wrap break-words">{request.exchangeNote}</dd>
                      </>
                    )
                  ) : (
                    request.resolutionAmount && (
                      <>
                        <dt className="text-muted-foreground">{copy.resolutionAmount}</dt>
                        <dd>{formatMoney(request.resolutionAmount)}</dd>
                      </>
                    )
                  )}
                </>
              )}
              {request.returnMethod && (
                <>
                  <dt className="text-muted-foreground">{copy.returnMethod}</dt>
                  <dd>{copy.returnMethods[request.returnMethod]}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{copy.due}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {formatEventTime(request.dueAt)}
                {request.overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
              </dd>
              <dt className="text-muted-foreground">{copy.decisionNote}</dt>
              <dd className="whitespace-pre-wrap break-words">{decisionNote ?? copy.noDecisionNote}</dd>
            </dl>
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{copy.items}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {items.map((item) => (
                  <li key={item.lineRef} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <p className="font-medium break-words">{item.name}</p>
                    <p className="text-muted-foreground">
                      {copy.itemSku(item.sku)} · {copy.itemQuantity(item.quantity)} · {formatMoney(item.unitPrice)}{" "}
                      {copy.itemUnitPrice}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{copy.itemReason}: </span>
                      {copy.reasonCodes[item.reasonCode]}
                    </p>
                    {item.comment && (
                      <p className="whitespace-pre-wrap break-words">
                        <span className="text-muted-foreground">{copy.itemComment}: </span>
                        {item.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
              <DecisionActions
                id={request.id}
                allowed={request.allowedTransitions}
                approvalBlocked={approvalBlockedFor(agent, request, getApprovalConfig().refundApprovalLimit)}
              />
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
    </AdminShell>
  );
}
