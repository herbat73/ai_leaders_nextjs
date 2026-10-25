import Link from "next/link";
import { formatEventTime, RETURN_STATUSES, returnListQuerySchema, type ReturnListItem, type StoredReturnStatus } from "@easyrms/core";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, type DataTableColumn } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { returnsCopy } from "./copy";
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
        {item.overdue && <Badge variant="destructive">{copy.overdue}</Badge>}
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
  const requested = (await searchParams).status;
  const parsed = requested === undefined ? undefined : returnListQuerySchema.safeParse({ status: requested });
  const filter = parsed?.success ? parsed.data.status : undefined;
  const filterIsInvalid = parsed !== undefined && !parsed.success;

  const scope = await createRequestScope();
  const returns = await scope.cradle.returnService.list(filter ? { status: filter } : undefined);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(returns.length)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <nav aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant={filter ? "outline" : "default"}>
                <Link href="/admin/returns" aria-current={filter ? undefined : "page"}>
                  {copy.allStatuses}
                </Link>
              </Button>
              {FILTERS.map((status) => (
                <Button key={status} asChild size="sm" variant={filter === status ? "default" : "outline"}>
                  <Link href={`/admin/returns?status=${status}`} aria-current={filter === status ? "page" : undefined}>
                    {returnsCopy.statusLabels[status]}
                  </Link>
                </Button>
              ))}
            </nav>
            {filterIsInvalid && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.invalidFilter}
              </p>
            )}
            <DataTable
              columns={columns}
              rows={returns}
              getRowKey={(item) => item.id}
              emptyMessage={filter ? copy.emptyFiltered : copy.empty}
            />
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
