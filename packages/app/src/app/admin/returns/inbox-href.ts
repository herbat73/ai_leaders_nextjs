import type { RequestKind, StoredReturnStatus } from "@easyrms/core";

export interface InboxParams {
  status?: StoredReturnStatus;
  kind?: RequestKind;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Inbox URL for a filter state; empty values and page 1 are left out. */
export function inboxHref(params: InboxParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.kind) search.set("kind", params.kind);
  if (params.q) search.set("q", params.q);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const text = search.toString();
  return text ? `/admin/returns?${text}` : "/admin/returns";
}
