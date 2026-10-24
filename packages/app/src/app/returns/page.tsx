import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatDatePl } from "@easyrms/core";
import { actionClassName } from "@easyrms/ui/public";

import { createRequestScope } from "@/server/container";
import { GUEST_SESSION_COOKIE, getGuestSessionService } from "@/server/guest-session";
import { statusLabels } from "./_lib/status-labels";
import { overviewCopy as copy } from "./copy";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function ReturnsOverviewPage() {
  const cookieStore = await cookies();
  const session = await getGuestSessionService().verify(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  // Local data only: the order platform is not called here. The "start a return" action is always shown; eligibility
  // (delivery, window, remaining quantities) is re-checked by the wizard page, which loads the order anyway.
  const scope = await createRequestScope();
  const requests = await scope.cradle.returnService.listForOrder(session.orderNumber);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <LogoutButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.orderLabel}: <strong className="font-mono">{session.orderNumber}</strong>
        </p>
      </header>

      <section aria-label={copy.listLabel}>
        {requests.length === 0 ? (
          <p className="text-sm">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {requests.map((request) => (
              <li key={request.rma}>
                <Link href={`/returns/${request.rma}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted">
                  <span className="font-mono">{request.rma}</span>
                  <span className="text-sm">{statusLabels[request.status]}</span>
                  <span className="text-sm text-muted-foreground">
                    {copy.submittedOn} {formatDatePl(request.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/returns/new" className={actionClassName()}>
        {copy.start}
      </Link>
    </main>
  );
}
