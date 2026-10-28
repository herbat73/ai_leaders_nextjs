import Link from "next/link";
import { RETURN_STATUSES, type StoredReturnStatus } from "@easyrms/core";
import { actionClassName } from "@easyrms/ui/public";

import { overviewCopy } from "../copy";
import { statusLabels } from "../_lib/status-labels";

const copy = overviewCopy.filters;
const STATUSES: StoredReturnStatus[] = [...RETURN_STATUSES, "unknown"];
const fieldClassName = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

interface ListFiltersProps {
  status?: StoredReturnStatus;
  q?: string;
  from?: string;
  to?: string;
  narrowed: boolean;
}

/** Plain GET form: the state lives in the URL, so it works without JavaScript and "Wyczyść" is just a link. */
export function ListFilters({ status, q, from, to, narrowed }: ListFiltersProps) {
  return (
    <form method="get" action="/returns" aria-label={copy.label} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        <span>{copy.status}</span>
        <select name="status" defaultValue={status ?? ""} className={fieldClassName}>
          <option value="">{copy.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>{copy.rma}</span>
        <input type="search" name="q" defaultValue={q ?? ""} placeholder={copy.rmaPlaceholder} className={fieldClassName} />
      </label>
      <label className="space-y-1 text-sm">
        <span>{copy.from}</span>
        <input type="date" name="from" defaultValue={from ?? ""} className={fieldClassName} />
      </label>
      <label className="space-y-1 text-sm">
        <span>{copy.to}</span>
        <input type="date" name="to" defaultValue={to ?? ""} className={fieldClassName} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={actionClassName()}>
          {copy.submit}
        </button>
        {narrowed && (
          <Link href="/returns" className="text-sm underline underline-offset-4">
            {copy.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
