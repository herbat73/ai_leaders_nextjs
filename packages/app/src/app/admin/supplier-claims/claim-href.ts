import type { StoredSupplierClaimStatus } from "@easyrms/core";

export interface ClaimParams {
  status?: StoredSupplierClaimStatus;
  q?: string;
  supplier?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Supplier claims URL for a filter state; empty values and page 1 are left out. */
export function claimHref(params: ClaimParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.supplier) search.set("supplier", params.supplier);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const text = search.toString();
  return text ? `/admin/supplier-claims?${text}` : "/admin/supplier-claims";
}
