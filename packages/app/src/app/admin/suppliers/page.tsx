import Link from "next/link";
import { hasPermission, viewSuppliers, type SupplierStatusFilter } from "@easyrms/core";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { AdminShell } from "../_shell/admin-shell";
import { suppliersCopy as copy } from "./copy";
import { SupplierFilters } from "./supplier-filters";
import { supplierHref } from "./supplier-href";
import { SuppliersManager } from "./suppliers-manager";

export const dynamic = "force-dynamic";

const text = (value: string | string[] | undefined): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const agent = await requireAgentPage("/admin/suppliers");
  const query = await searchParams;
  const status: SupplierStatusFilter | undefined = query.status === "active" || query.status === "inactive" ? query.status : undefined;
  const name = text(query.name);
  const email = text(query.email);

  const scope = await createRequestScope();
  const suppliers = await scope.cradle.supplierService.list();
  // The directory is small, so it is narrowed and paged in memory (spec 2026-11-10-supplier-list-filters).
  const view = viewSuppliers(suppliers, { status, name, email, page: Number(text(query.page)) });
  const state = { status, name, email };
  const narrowed = Boolean(status || name || email);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-5xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description(suppliers.length, view.total)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SupplierFilters current={state} />
            <SuppliersManager suppliers={view.rows} canManage={hasPermission(agent, "MANAGE_RULES")} narrowed={narrowed} />
            {view.pageCount > 1 && (
              <nav aria-label={copy.pagination.label} className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">{copy.pagination.position(view.page, view.pageCount)}</span>
                <Button asChild={view.page > 1} size="sm" variant="outline" disabled={view.page <= 1}>
                  {view.page > 1 ? <Link href={supplierHref({ ...state, page: view.page - 1 })}>{copy.pagination.previous}</Link> : copy.pagination.previous}
                </Button>
                <Button asChild={view.page < view.pageCount} size="sm" variant="outline" disabled={view.page >= view.pageCount}>
                  {view.page < view.pageCount ? <Link href={supplierHref({ ...state, page: view.page + 1 })}>{copy.pagination.next}</Link> : copy.pagination.next}
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
