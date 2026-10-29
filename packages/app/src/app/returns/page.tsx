import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatDatePl, RETURN_STATUSES, viewInbox, type StoredReturnStatus } from "@easyrms/core";
import { actionClassName } from "@easyrms/ui/public";

import { createRequestScope } from "@/server/container";
import { GUEST_SESSION_COOKIE, getGuestSessionService } from "@/server/guest-session";
import { ListFilters } from "./_components/list-filters";
import { listHref } from "./_lib/list-href";
import { statusLabels } from "./_lib/status-labels";
import { overviewCopy as copy } from "./copy";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const STATUSES: readonly string[] = [...RETURN_STATUSES, "unknown"];
const text = (value: string | string[] | undefined): string | undefined => (typeof value === "string" && value ? value : undefined);

export default async function ReturnsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const session = await getGuestSessionService().verify(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  // Local data only: the order platform is not called here. The "start a return" action is always shown; eligibility
  // (delivery, window, remaining quantities) is re-checked by the wizard page, which loads the order anyway.
  const scope = await createRequestScope();
  const all = await scope.cradle.returnService.listForOrder(session.orderNumber);

  // The order comes only from the session; the URL can narrow the list, never widen it. Unknown values are ignored.
  const query = await searchParams;
  const rawStatus = text(query.status);
  const status = rawStatus && STATUSES.includes(rawStatus) ? (rawStatus as StoredReturnStatus) : undefined;
  const q = text(query.q);
  const from = text(query.from);
  const to = text(query.to);
  const view = viewInbox(all, { status, search: q, from, to, page: Number(text(query.page)) });
  const state = { status, q, from, to };
  const narrowed = Boolean(status || q || from || to);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <LogoutButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.orderLabel}: <strong className="font-mono">{session.orderNumber}</strong>
        </p>
      </header>

      <section aria-label={copy.listLabel} className="space-y-4">
        {all.length > 0 && <ListFilters {...state} narrowed={narrowed} />}
        {view.total === 0 ? (
          <p className="text-sm">{all.length === 0 ? copy.empty : copy.emptyFiltered}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {view.rows.map((request) => (
              <li key={request.rma}>
                <Link href={`/returns/${request.rma}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted">
                  <span className="font-mono">{request.rma}</span>
                  <span className="text-sm">{copy.kinds[request.kind]}</span>
                  <span className="text-sm">{statusLabels[request.status]}</span>
                  <span className="text-sm text-muted-foreground">
                    {copy.submittedOn} {formatDatePl(request.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {view.pageCount > 1 && (
          <nav aria-label={copy.pagination.label} className="flex items-center justify-end gap-4 text-sm">
            <span className="text-muted-foreground">{copy.pagination.position(view.page, view.pageCount)}</span>
            {view.page > 1 ? (
              <Link href={listHref({ ...state, page: view.page - 1 })}>{copy.pagination.previous}</Link>
            ) : (
              <span aria-disabled="true" className="text-muted-foreground">{copy.pagination.previous}</span>
            )}
            {view.page < view.pageCount ? (
              <Link href={listHref({ ...state, page: view.page + 1 })}>{copy.pagination.next}</Link>
            ) : (
              <span aria-disabled="true" className="text-muted-foreground">{copy.pagination.next}</span>
            )}
          </nav>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/returns/new" className={actionClassName()}>
          {copy.start}
        </Link>
        <Link href="/returns/complaint/new" className={actionClassName("secondary")}>
          {copy.startComplaint}
        </Link>
      </div>
    </main>
  );
}
