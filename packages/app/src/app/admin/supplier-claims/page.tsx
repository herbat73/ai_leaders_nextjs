import Link from "next/link";
import { formatEventTime, formatMoney, SUPPLIER_CLAIM_STATUSES, supplierClaimListQuerySchema, type StoredSupplierClaimStatus, type SupplierClaimView } from "@easyrms/core";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, type DataTableColumn } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { claimsCopy } from "./copy";
import { claimBadgeVariant } from "./status-badge";

export const dynamic = "force-dynamic";

const copy = claimsCopy.list;
const FILTERS: StoredSupplierClaimStatus[] = [...SUPPLIER_CLAIM_STATUSES, "unknown"];

const columns: DataTableColumn<SupplierClaimView>[] = [
  {
    key: "ref",
    header: copy.columns.ref,
    className: "font-medium",
    cell: (claim) => (
      <Link href={`/admin/supplier-claims/${claim.id}`} className="underline underline-offset-4">
        {claim.ref}
      </Link>
    ),
  },
  {
    key: "rma",
    header: copy.columns.rma,
    cell: (claim) => (
      <Link href={`/admin/returns/${claim.returnRequestId}`} className="underline underline-offset-4">
        {claim.rma}
      </Link>
    ),
  },
  { key: "supplier", header: copy.columns.supplier, cell: (claim) => claim.supplierName },
  { key: "status", header: copy.columns.status, cell: (claim) => <Badge variant={claimBadgeVariant[claim.status]}>{claimsCopy.statusLabels[claim.status]}</Badge> },
  { key: "sent", header: copy.columns.sent, cell: (claim) => (claim.sentAt ? formatEventTime(claim.sentAt) : copy.notSent) },
  { key: "credit", header: copy.columns.credit, cell: (claim) => (claim.creditAmount ? formatMoney(claim.creditAmount) : copy.noCredit) },
];

export default async function AdminSupplierClaimsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const agent = await requireAgentPage("/admin/supplier-claims");
  const requested = (await searchParams).status;
  const parsed = requested === undefined ? undefined : supplierClaimListQuerySchema.safeParse({ status: requested });
  const filter = parsed?.success ? parsed.data.status : undefined;

  const scope = await createRequestScope();
  const claims = await scope.cradle.supplierClaimService.list(filter ? { status: filter } : undefined);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(claims.length)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <nav aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant={filter ? "outline" : "default"}>
                <Link href="/admin/supplier-claims" aria-current={filter ? undefined : "page"}>
                  {copy.all}
                </Link>
              </Button>
              {FILTERS.map((status) => (
                <Button key={status} asChild size="sm" variant={filter === status ? "default" : "outline"}>
                  <Link href={`/admin/supplier-claims?status=${status}`} aria-current={filter === status ? "page" : undefined}>
                    {claimsCopy.statusLabels[status]}
                  </Link>
                </Button>
              ))}
            </nav>
            {parsed !== undefined && !parsed.success && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.invalidFilter}
              </p>
            )}
            <DataTable columns={columns} rows={claims} getRowKey={(claim) => claim.id} emptyMessage={filter ? copy.emptyFiltered : copy.empty} />
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
