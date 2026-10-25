import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { warsawDateString, type ReturnLookupView } from "@easyrms/core";
import { Banner } from "@easyrms/ui/public";

import { createRequestScope } from "@/server/container";
import { GUEST_SESSION_COOKIE, getGuestSessionService } from "@/server/guest-session";
import { RetryButton } from "../../new/retry-button";
import { complaintCopy as copy } from "./copy";
import { ComplaintWizard } from "./complaint-wizard";

export const dynamic = "force-dynamic";

/** Next bundles `@easyrms/core` once per layer, so match on the stable error code, not `instanceof`. */
function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}

type Loaded = { kind: "ok"; view: ReturnLookupView } | { kind: "unavailable" };

async function load(orderNumber: string): Promise<Loaded> {
  const scope = await createRequestScope();
  try {
    return { kind: "ok", view: await scope.cradle.returnLookupService.describeOrder(orderNumber, "complaint") };
  } catch (error) {
    const code = errorCode(error);
    if (code === "service_unavailable") return { kind: "unavailable" };
    if (code === "not_found") redirect("/");
    throw error;
  }
}

export default async function NewComplaintPage() {
  const cookieStore = await cookies();
  const session = await getGuestSessionService().verify(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const loaded = await load(session.orderNumber);
  if (loaded.kind === "ok" && loaded.view.deliveredAt === null) redirect("/returns");

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <Link href="/returns" className="text-sm underline underline-offset-4">
          {copy.back}
        </Link>
        <h1 className="text-2xl font-semibold">{copy.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.orderLabel}: <strong className="font-mono">{session.orderNumber}</strong>
        </p>
      </header>
      {loaded.kind === "unavailable" ? (
        <Banner tone="error">
          <p className="font-medium">{copy.unavailable.title}</p>
          <p>{copy.unavailable.text}</p>
          <p className="mt-2">
            <RetryButton label={copy.unavailable.retry} />
          </p>
        </Banner>
      ) : (
        <ComplaintWizard
          lines={loaded.view.lines}
          today={warsawDateString(new Date())}
          deliveredOn={loaded.view.deliveredAt ? warsawDateString(new Date(loaded.view.deliveredAt)) : null}
        />
      )}
    </main>
  );
}
