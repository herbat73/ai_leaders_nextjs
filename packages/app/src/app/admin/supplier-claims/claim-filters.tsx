"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { StoredSupplierClaimStatus } from "@easyrms/core";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@easyrms/ui/admin";

import { claimsCopy } from "./copy";
import { claimHref, type ClaimParams } from "./claim-href";

const copy = claimsCopy.list.filters;
const ALL = "all";

/** Client island of the supplier claims list: status dropdown, number and supplier search, creation-date range; every change navigates with the URL. */
export function ClaimFilters({ current, statuses }: { current: ClaimParams; statuses: StoredSupplierClaimStatus[] }): ReactElement {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");
  const [supplier, setSupplier] = useState(current.supplier ?? "");
  const [from, setFrom] = useState(current.from ?? "");
  const [to, setTo] = useState(current.to ?? "");

  const go = (next: ClaimParams): void => router.push(claimHref(next));
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    go({ status: current.status, q: q.trim(), supplier: supplier.trim(), from, to });
  };
  // The drafts are copied from the URL once and the island stays mounted, so clearing must reset them here.
  const clear = (): void => {
    setQ("");
    setSupplier("");
    setFrom("");
    setTo("");
    go({ status: current.status });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="claim-filter-status">{copy.status}</Label>
        <Select
          value={current.status ?? ALL}
          onValueChange={(value) =>
            go({ status: value === ALL ? undefined : (value as StoredSupplierClaimStatus), q: q.trim(), supplier: supplier.trim(), from, to })
          }
        >
          <SelectTrigger id="claim-filter-status" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{copy.allStatuses}</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {claimsCopy.statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="claim-filter-q">{copy.number}</Label>
        <Input id="claim-filter-q" type="search" placeholder={copy.numberPlaceholder} className="w-full sm:w-56" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="claim-filter-supplier">{copy.supplier}</Label>
        <Input id="claim-filter-supplier" type="search" placeholder={copy.supplierPlaceholder} className="w-full sm:w-56" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="claim-filter-from">{copy.from}</Label>
        <Input id="claim-filter-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="claim-filter-to">{copy.to}</Label>
        <Input id="claim-filter-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="submit" size="sm">
        {copy.apply}
      </Button>
      {(current.q || current.supplier || current.from || current.to) && (
        <Button type="button" size="sm" variant="outline" onClick={clear}>
          {copy.clear}
        </Button>
      )}
    </form>
  );
}
