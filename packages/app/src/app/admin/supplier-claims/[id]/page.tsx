import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEventTime, formatMoney, type SupplierClaimDetail, type SupplierClaimEvent } from "@easyrms/core";
import { Badge, Card, CardContent, CardHeader, CardTitle, Timeline, type TimelineEvent } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../../_shell/admin-shell";
import { claimsCopy } from "../copy";
import { claimBadgeVariant } from "../status-badge";
import { ClaimActions } from "./claim-actions";

export const dynamic = "force-dynamic";

const copy = claimsCopy.page;

function toTimelineEvent(event: SupplierClaimEvent): TimelineEvent {
  return {
    id: event.id,
    label: event.type === "created" ? copy.eventLabels.created : claimsCopy.statusLabels[event.toStatus],
    actor: event.agentName ?? claimsCopy.actors.agent,
    at: formatEventTime(event.createdAt),
    note: event.note ?? undefined,
  };
}

/** Next bundles `@easyrms/core` once per layer, so match on the stable error code, not `instanceof`. */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function loadDetail(id: number): Promise<SupplierClaimDetail> {
  const scope = await createRequestScope();
  try {
    return await scope.cradle.supplierClaimService.getDetail(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export default async function SupplierClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const agent = await requireAgentPage(`/admin/supplier-claims/${rawId}`);
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) notFound();

  const { claim, events } = await loadDetail(id);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <Link href="/admin/supplier-claims" className="text-sm underline underline-offset-4">
          {copy.back}
        </Link>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle>{claim.ref}</CardTitle>
            <Badge variant={claimBadgeVariant[claim.status]}>{claimsCopy.statusLabels[claim.status]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {claim.status === "draft" && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.draftWarning}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
              <dt className="text-muted-foreground">{copy.complaint}</dt>
              <dd>
                <Link href={`/admin/returns/${claim.returnRequestId}`} className="underline underline-offset-4">
                  {claim.rma}
                </Link>
              </dd>
              <dt className="text-muted-foreground">{copy.supplier}</dt>
              <dd className="break-words">{claim.supplierName}</dd>
              <dt className="text-muted-foreground">{copy.supplierEmail}</dt>
              <dd className="break-words">{claim.supplierEmail}</dd>
              {claim.sentAt && (
                <>
                  <dt className="text-muted-foreground">{copy.sentAt}</dt>
                  <dd>{formatEventTime(claim.sentAt)}</dd>
                </>
              )}
              {claim.answeredAt && (
                <>
                  <dt className="text-muted-foreground">{copy.answeredAt}</dt>
                  <dd>{formatEventTime(claim.answeredAt)}</dd>
                </>
              )}
              {claim.creditAmount && (
                <>
                  <dt className="text-muted-foreground">{copy.creditAmount}</dt>
                  <dd>{formatMoney(claim.creditAmount)}</dd>
                </>
              )}
              {claim.creditedAt && (
                <>
                  <dt className="text-muted-foreground">{copy.creditedAt}</dt>
                  <dd>{formatEventTime(claim.creditedAt)}</dd>
                </>
              )}
              {claim.answerNote && (
                <>
                  <dt className="text-muted-foreground">{copy.answerNote}</dt>
                  <dd className="whitespace-pre-wrap break-words">{claim.answerNote}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.actions}</CardTitle>
          </CardHeader>
          <CardContent>
            {claim.status === "unknown" ? null : <ClaimActions id={claim.id} allowed={claim.allowedTransitions} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.emailHeading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">{copy.emailSubject}: </span>
              <span className="font-medium break-words">{claim.subject}</span>
            </p>
            <pre className="font-sans whitespace-pre-wrap break-words rounded-md bg-muted p-3">{claim.body}</pre>
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
