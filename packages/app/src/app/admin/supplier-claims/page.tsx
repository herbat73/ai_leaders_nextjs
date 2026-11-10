import Link from "next/link";
import { formatEventTime, formatMoney, SUPPLIER_CLAIM_STATUSES, supplierClaimListQuerySchema, viewSupplierClaims, type StoredSupplierClaimStatus, type SupplierClaimView } from "@easyrms/core";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, type DataTableColumn } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { claimsCopy } from "./copy";
import { ClaimFilters } from "./claim-filters";
import { claimHref } from "./claim-href";
import { claimBadgeVariant } from "./status-badge";

export const dynamic = "force-dynamic";

const copy = claimsCopy.list;
const FILTERS: StoredSupplierClaimStatus[] = [...SUPPLIER_CLAIM_STATUSES, "unknown"];

const text = (value: string | string[] | undefined): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

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
  const query = await searchParams;
  const requested = query.status;
  const parsed = requested === undefined ? undefined : supplierClaimListQuerySchema.safeParse({ status: requested });
  const filter = parsed?.success ? parsed.data.status : undefined;

  const q = text(query.q);
  const supplier = text(query.supplier);
  const from = text(query.from);
  const to = text(query.to);

  const scope = await createRequestScope();
  const claims = await scope.cradle.supplierClaimService.list(filter ? { status: filter } : undefined);
  // Claims only exist for complaints that reached a vendor, so they are narrowed and paged in memory (spec 2026-11-10-supplier-claims-list-filters).
  const view = viewSupplierClaims(claims, { q, supplier, from, to, page: Number(text(query.page)) });
  const state = { status: filter, q, supplier, from, to };
  const narrowed = Boolean(filter || q || supplier || from || to);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(claims.length, view.total)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClaimFilters current={state} statuses={FILTERS} />
            {parsed !== undefined && !parsed.success && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.invalidFilter}
              </p>
            )}
            <DataTable columns={columns} rows={view.rows} getRowKey={(claim) => claim.id} emptyMessage={narrowed ? copy.emptyFiltered : copy.empty} />
            {view.pageCount > 1 && (
              <nav aria-label={copy.pagination.label} className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">{copy.pagination.position(view.page, view.pageCount)}</span>
                <Button asChild={view.page > 1} size="sm" variant="outline" disabled={view.page <= 1}>
                  {view.page > 1 ? <Link href={claimHref({ ...state, page: view.page - 1 })}>{copy.pagination.previous}</Link> : copy.pagination.previous}
                </Button>
                <Button asChild={view.page < view.pageCount} size="sm" variant="outline" disabled={view.page >= view.pageCount}>
                  {view.page < view.pageCount ? <Link href={claimHref({ ...state, page: view.page + 1 })}>{copy.pagination.next}</Link> : copy.pagination.next}
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
