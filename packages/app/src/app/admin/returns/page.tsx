import { RETURN_STATUSES, type ReturnStatus } from "@easyrms/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@easyrms/ui/admin";

import { createRequestScope } from "@/server/container";
import { setReturnStatus } from "../../actions";

export const dynamic = "force-dynamic";

const badgeVariant: Record<ReturnStatus, "default" | "secondary" | "destructive" | "outline"> = {
  requested: "outline",
  approved: "default",
  rejected: "destructive",
  received: "secondary",
  refunded: "secondary",
};

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Change status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No returns yet.</TableCell>
                </TableRow>
              )}
              {returns.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.orderNumber}</TableCell>
                  <TableCell>{item.customerEmail}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.reason}</TableCell>
                  <TableCell><Badge variant={badgeVariant[item.status]}>{item.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {RETURN_STATUSES.filter((status) => status !== item.status).map((status) => (
                        <form key={status} action={setReturnStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value={status} />
                          <Button type="submit" size="sm" variant="outline">{status}</Button>
                        </form>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
