import type { SupplierStatusFilter } from "@easyrms/core";

export interface SupplierParams {
  status?: SupplierStatusFilter;
  name?: string;
  email?: string;
  page?: number;
}

/** Suppliers URL for a filter state; empty values and page 1 are left out. */
export function supplierHref(params: SupplierParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.name) search.set("name", params.name);
  if (params.email) search.set("email", params.email);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const text = search.toString();
  return text ? `/admin/suppliers?${text}` : "/admin/suppliers";
}
