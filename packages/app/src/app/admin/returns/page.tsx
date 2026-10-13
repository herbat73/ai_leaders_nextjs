import type { ReturnRequest, ReturnStatus } from "@easyrms/core";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, type DataTableColumn } from "@easyrms/ui/admin";

import { createRequestScope } from "@/server/container";
import { ReturnStatusActions } from "./return-status-actions";

export const dynamic = "force-dynamic";

const badgeVariant: Record<ReturnStatus, "default" | "secondary" | "destructive" | "outline"> = {
  requested: "outline",
  approved: "default",
  rejected: "destructive",
  received: "secondary",
  refunded: "secondary",
};

const columns: DataTableColumn<ReturnRequest>[] = [
  { key: "order", header: "Order", className: "font-medium", cell: (item) => item.orderNumber },
  { key: "customer", header: "Customer", cell: (item) => item.customerEmail },
  { key: "reason", header: "Reason", className: "max-w-xs truncate", cell: (item) => item.reason },
  { key: "status", header: "Status", cell: (item) => <Badge variant={badgeVariant[item.status]}>{item.status}</Badge> },
  { key: "actions", header: "Change status", cell: (item) => <ReturnStatusActions id={item.id} current={item.status} /> },
];

export default async function AdminReturnsPage() {
  const scope = await createRequestScope();
  const returns = await scope.cradle.returnService.list();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>Returns</CardTitle>
          <CardDescription>{returns.length} return request(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={returns} getRowKey={(item) => item.id} emptyMessage="No returns yet." />
        </CardContent>
      </Card>
    </main>
  );
}
