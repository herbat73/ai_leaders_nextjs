import Link from "next/link";
import { notFound } from "next/navigation";
import { approvalBlockedFor, formatDatePl, formatEventTime, formatMoney, type ReturnDetailView, type ReturnEvent } from "@easyrms/core";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Timeline, type TimelineEvent } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { getApprovalConfig } from "@/server/return-config";
import { AdminShell } from "../../_shell/admin-shell";
import { returnsCopy } from "../copy";
import { statusBadgeVariant } from "../status-badge";
import { claimBadgeVariant } from "../../supplier-claims/status-badge";
import { claimsCopy } from "../../supplier-claims/copy";
import { DecisionActions } from "./decision-actions";
import { SupplierClaimForm } from "./supplier-claim-form";

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

  // The vendor claim section: only for a complaint whose defect was confirmed.
  const claimable = request.kind === "complaint" && request.defectConfirmed === true;
  const scope = await createRequestScope();
  const [existingClaim, suppliers] = claimable
    ? await Promise.all([scope.cradle.supplierClaimService.findForComplaint(id), scope.cradle.supplierService.list()])
    : [null, []];
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/admin/returns" className="underline underline-offset-4">
            {copy.back}
          </Link>
          <Link href={`/admin/returns/${id}/customer-view`} className="underline underline-offset-4">
            {copy.customerView}
          </Link>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>{request.rma}</CardTitle>
            <Badge variant={statusBadgeVariant[request.status]}>{returnsCopy.statusLabels[request.status]}</Badge>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
              <dt className="text-muted-foreground">{copy.kind}</dt>
              <dd>{copy.kinds[request.kind]}</dd>
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
              {request.kind === "complaint" && (
                <>
                  {request.defectDescription && (
                    <>
                      <dt className="text-muted-foreground">{copy.defectDescription}</dt>
                      <dd className="whitespace-pre-wrap break-words">{request.defectDescription}</dd>
                    </>
                  )}
                  {request.defectDiscoveredOn && (
                    <>
                      <dt className="text-muted-foreground">{copy.defectDiscoveredOn}</dt>
                      <dd>{formatDatePl(new Date(`${request.defectDiscoveredOn}T12:00:00Z`))}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">{copy.defectFinding}</dt>
                  <dd>
                    {request.defectConfirmed == null
                      ? copy.defectNotAssessed
                      : request.defectConfirmed
                        ? copy.defectConfirmed
                        : copy.defectNotConfirmed}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">{request.kind === "complaint" ? copy.dueComplaint : copy.due}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {formatEventTime(request.dueAt)}
                {request.overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
                {request.escalated && <Badge variant="destructive">{copy.escalated}</Badge>}
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
                    {item.serialNumber && (
                      <p>
                        <span className="text-muted-foreground">{copy.serialNumber}: </span>
                        {item.serialNumber}
                      </p>
                    )}
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
                complaint={request.kind === "complaint"}
                approvalBlocked={approvalBlockedFor(agent, request, getApprovalConfig().refundApprovalLimit)}
              />
            )}
          </CardContent>
        </Card>

        {claimable && (
          <Card>
            <CardHeader>
              <CardTitle>{claimsCopy.section.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              {existingClaim ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{existingClaim.ref}</span>
                  <span>{existingClaim.supplierName}</span>
                  <Badge variant={claimBadgeVariant[existingClaim.status]}>{claimsCopy.statusLabels[existingClaim.status]}</Badge>
                  <Link href={`/admin/supplier-claims/${existingClaim.id}`} className="underline underline-offset-4">
                    {claimsCopy.section.open}
                  </Link>
                </div>
              ) : activeSuppliers.length === 0 ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{claimsCopy.section.noSuppliers}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/admin/suppliers">{claimsCopy.section.addSupplier}</Link>
                  </Button>
                </div>
              ) : (
                <SupplierClaimForm
                  returnId={request.id}
                  suppliers={activeSuppliers.map(({ id: supplierId, name, guidelines }) => ({ id: supplierId, name, guidelines }))}
                  composition={{
                    rma: request.rma,
                    orderNumber: request.orderNumber,
                    items,
                    defectDescription: request.defectDescription ?? "",
                    defectDiscoveredOn: request.defectDiscoveredOn ?? null,
                    agent: { displayName: agent.displayName, email: agent.email },
                  }}
                  mailDelivers={scope.cradle.mailPort.delivers === true}
                />
              )}
            </CardContent>
          </Card>
        )}

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
