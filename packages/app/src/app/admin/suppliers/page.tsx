import { hasPermission } from "@easyrms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { suppliersCopy as copy } from "./copy";
import { SuppliersManager } from "./suppliers-manager";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const agent = await requireAgentPage("/admin/suppliers");
  const scope = await createRequestScope();
  const suppliers = await scope.cradle.supplierService.list();

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(suppliers.length)}</CardDescription>
          </CardHeader>
          <CardContent>
            <SuppliersManager suppliers={suppliers} canManage={hasPermission(agent, "MANAGE_RULES")} />
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
