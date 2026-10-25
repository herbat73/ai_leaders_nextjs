import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReturnDetailView } from "@easyrms/core";

import { createRequestScope } from "@/server/container";
import { GUEST_SESSION_COOKIE, getGuestSessionService } from "@/server/guest-session";
import { TrackerBody } from "../_components/tracker-body";
import { complaintTrackerCopy, trackerCopy as copy } from "../_components/tracker-copy";

export const dynamic = "force-dynamic";

/** Next bundles `@easyrms/core` once per layer, so match on the stable error code, not `instanceof`. */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function loadDetail(orderNumber: string, rma: string): Promise<ReturnDetailView> {
  const scope = await createRequestScope();
  try {
    // Local data only (S6): the order platform is never called from the tracker.
    return await scope.cradle.returnService.getByRma(orderNumber, rma);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export default async function TrackerPage({ params }: { params: Promise<{ rma: string }> }) {
  const { rma } = await params;
  const cookieStore = await cookies();
  const session = await getGuestSessionService().verify(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  // Another order's session gets the same 404 as an unknown RMA: existence is never revealed.
  const detail = await loadDetail(session.orderNumber, rma);
  const { request } = detail;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/returns" className="text-sm underline underline-offset-4">
          {copy.back}
        </Link>
        <h1 className="text-2xl font-semibold">{request.kind === "complaint" ? complaintTrackerCopy.title : copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.confirmation}</p>
        <p className="text-sm">
          {copy.reference}: <strong className="font-mono text-base">{request.rma}</strong>
        </p>
      </header>

      <TrackerBody detail={detail} />
    </main>
  );
}
