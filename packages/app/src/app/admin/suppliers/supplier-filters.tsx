"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { SupplierStatusFilter } from "@easyrms/core";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@easyrms/ui/admin";

import { suppliersCopy } from "./copy";
import { supplierHref, type SupplierParams } from "./supplier-href";

const copy = suppliersCopy.filters;
const ALL = "all";

/** Client island of the suppliers screen: status dropdown and name / e-mail search; every change navigates with the URL. */
export function SupplierFilters({ current }: { current: SupplierParams }): ReactElement {
  const router = useRouter();
  const [name, setName] = useState(current.name ?? "");
  const [email, setEmail] = useState(current.email ?? "");

  const go = (next: SupplierParams): void => router.push(supplierHref(next));
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    go({ status: current.status, name: name.trim(), email: email.trim() });
  };
  // The drafts are copied from the URL once and the island stays mounted, so clearing must reset them here.
  const clear = (): void => {
    setName("");
    setEmail("");
    go({ status: current.status });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="supplier-filter-status">{copy.status}</Label>
        <Select
          value={current.status ?? ALL}
          onValueChange={(value) => go({ status: value === ALL ? undefined : (value as SupplierStatusFilter), name: name.trim(), email: email.trim() })}
        >
          <SelectTrigger id="supplier-filter-status" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{copy.statusOptions.all}</SelectItem>
            <SelectItem value="active">{copy.statusOptions.active}</SelectItem>
            <SelectItem value="inactive">{copy.statusOptions.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="supplier-filter-name">{copy.name}</Label>
        <Input id="supplier-filter-name" type="search" placeholder={copy.namePlaceholder} className="w-full sm:w-56" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="supplier-filter-email">{copy.email}</Label>
        <Input id="supplier-filter-email" type="search" placeholder={copy.emailPlaceholder} className="w-full sm:w-56" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="sm">
        {copy.apply}
      </Button>
      {(current.name || current.email) && (
        <Button type="button" size="sm" variant="outline" onClick={clear}>
          {copy.clear}
        </Button>
      )}
    </form>
  );
}
