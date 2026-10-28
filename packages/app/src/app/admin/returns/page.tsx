import Link from "next/link";
import {
  formatEventTime,
  REQUEST_KINDS,
  RETURN_STATUSES,
  viewInbox,
  returnListQuerySchema,
  type RequestKind,
  type ReturnListItem,
  type StoredReturnStatus,
} from "@easyrms/core";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, type DataTableColumn } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { returnsCopy } from "./copy";
import { InboxFilters } from "./inbox-filters";
import { inboxHref } from "./inbox-href";
import { statusBadgeVariant } from "./status-badge";

export const dynamic = "force-dynamic";

const copy = returnsCopy.inbox;
const FILTERS: StoredReturnStatus[] = [...RETURN_STATUSES, "unknown"];

const columns: DataTableColumn<ReturnListItem>[] = [
  {
    key: "rma",
    header: copy.columns.rma,
    className: "font-medium",
    cell: (item) => (
      <Link href={`/admin/returns/${item.id}`} className="underline underline-offset-4">
        {item.rma}
      </Link>
    ),
  },
  {
    key: "kind",
    header: copy.columns.kind,
    cell: (item) => <Badge variant={item.kind === "complaint" ? "secondary" : "outline"}>{copy.kindBadge[item.kind]}</Badge>,
  },
  { key: "order", header: copy.columns.order, cell: (item) => item.orderNumber },
  { key: "customer", header: copy.columns.customer, cell: (item) => item.customerEmail },
  {
    key: "status",
    header: copy.columns.status,
    cell: (item) => <Badge variant={statusBadgeVariant[item.status]}>{returnsCopy.statusLabels[item.status]}</Badge>,
  },
  {
    key: "due",
    header: copy.columns.due,
    cell: (item) => (
      <span className="flex flex-wrap items-center gap-2">
        {formatEventTime(item.dueAt)}
        {item.daysLeft != null && !item.overdue && <span className="text-muted-foreground">{copy.daysLeft(item.daysLeft)}</span>}
        {item.overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
        {item.escalated && <Badge variant="destructive">{copy.escalated}</Badge>}
      </span>
    ),
  },
];

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const agent = await requireAgentPage("/admin/returns");
  const query = await searchParams;
  const requested = { status: query.status, kind: query.kind };
  const parsed = requested.status === undefined && requested.kind === undefined ? undefined : returnListQuerySchema.safeParse(requested);
  const filter = parsed?.success ? parsed.data.status : undefined;
  const kindFilter: RequestKind | undefined = parsed?.success ? parsed.data.kind : undefined;
  const text = (value: string | string[] | undefined): string | undefined => (typeof value === "string" && value ? value : undefined);
  const q = text(query.q);
  const from = text(query.from);
  const to = text(query.to);
  const filterIsInvalid = parsed !== undefined && !parsed.success;

  const scope = await createRequestScope();
  const listed = await scope.cradle.returnService.list({
    ...(filter ? { status: filter } : {}),
    ...(kindFilter ? { kind: kindFilter } : {}),
  });
  // Escalated complaints go first (Q07); the repository's newest-first order is kept within each group.
  const returns = [...listed.filter((item) => item.escalated), ...listed.filter((item) => !item.escalated)];
  const view = viewInbox(returns, { search: q, from, to, page: Number(text(query.page)) });
  const state = { status: filter, kind: kindFilter, q, from, to };
  const narrowed = Boolean(filter || kindFilter || q || from || to);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(view.total)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <nav aria-label={copy.kindFilterLabel} className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant={kindFilter ? "outline" : "default"}>
                <Link href={inboxHref({ ...state, kind: undefined, page: undefined })} aria-current={kindFilter ? undefined : "page"}>
                  {copy.allKinds}
                </Link>
              </Button>
              {REQUEST_KINDS.map((kind) => (
                <Button key={kind} asChild size="sm" variant={kindFilter === kind ? "default" : "outline"}>
                  <Link href={inboxHref({ ...state, kind, page: undefined })} aria-current={kindFilter === kind ? "page" : undefined}>
                    {copy.kinds[kind]}
                  </Link>
                </Button>
              ))}
            </nav>
            <InboxFilters current={state} statuses={FILTERS} />
            {filterIsInvalid && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.invalidFilter}
              </p>
            )}
            <DataTable
              columns={columns}
              rows={view.rows}
              getRowKey={(item) => item.id}
              emptyMessage={narrowed ? copy.emptyFiltered : copy.empty}
            />
            {view.pageCount > 1 && (
              <nav aria-label={copy.pagination.label} className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">{copy.pagination.position(view.page, view.pageCount)}</span>
                <Button asChild={view.page > 1} size="sm" variant="outline" disabled={view.page <= 1}>
                  {view.page > 1 ? <Link href={inboxHref({ ...state, page: view.page - 1 })}>{copy.pagination.previous}</Link> : copy.pagination.previous}
                </Button>
                <Button asChild={view.page < view.pageCount} size="sm" variant="outline" disabled={view.page >= view.pageCount}>
                  {view.page < view.pageCount ? <Link href={inboxHref({ ...state, page: view.page + 1 })}>{copy.pagination.next}</Link> : copy.pagination.next}
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
