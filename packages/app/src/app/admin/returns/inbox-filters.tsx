"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { StoredReturnStatus } from "@easyrms/core";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@easyrms/ui/admin";

import { returnsCopy } from "./copy";
import { inboxHref, type InboxParams } from "./inbox-href";

const copy = returnsCopy.inbox;
const ALL = "all";

/** Client island of the inbox: status dropdown, RMA search and a submission-date range; every change navigates with the URL. */
export function InboxFilters({ current, statuses }: { current: InboxParams; statuses: StoredReturnStatus[] }): ReactElement {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");
  const [from, setFrom] = useState(current.from ?? "");
  const [to, setTo] = useState(current.to ?? "");

  const go = (next: InboxParams): void => router.push(inboxHref({ kind: current.kind, ...next }));
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    go({ status: current.status, q: q.trim(), from, to });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="inbox-status">{copy.filters.status}</Label>
        <Select
          value={current.status ?? ALL}
          onValueChange={(value) => go({ status: value === ALL ? undefined : (value as StoredReturnStatus), q: q.trim(), from, to })}
        >
          <SelectTrigger id="inbox-status" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{copy.allStatuses}</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {returnsCopy.statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="inbox-search">{copy.filters.search}</Label>
        <Input id="inbox-search" type="search" placeholder={copy.filters.searchPlaceholder} className="w-full sm:w-56" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="inbox-from">{copy.filters.from}</Label>
        <Input id="inbox-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="inbox-to">{copy.filters.to}</Label>
        <Input id="inbox-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="submit" size="sm">
        {copy.filters.apply}
      </Button>
      {(current.q || current.from || current.to) && (
        <Button type="button" size="sm" variant="outline" onClick={() => go({ status: current.status })}>
          {copy.filters.clear}
        </Button>
      )}
    </form>
  );
}
