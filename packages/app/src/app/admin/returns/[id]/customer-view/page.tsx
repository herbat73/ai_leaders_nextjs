import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReturnDetailView } from "@easyrms/core";
import { Alert, AlertDescription, AlertTitle } from "@easyrms/ui/admin";

import { requireAgentPage } from "@/server/agent-auth";
import { createRequestScope } from "@/server/container";
import { TrackerBody } from "../../../../returns/_components/tracker-body";
import { AdminShell } from "../../../_shell/admin-shell";
import { previewCopy as copy } from "./copy";

export const dynamic = "force-dynamic";

/** Next bundles `@easyrms/core` once per layer, so match on the stable error code, not `instanceof`. */
function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "not_found";
}

async function loadDetail(id: number): Promise<ReturnDetailView> {
  const scope = await createRequestScope();
  try {
    return await scope.cradle.returnService.getDetail(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

/** Read-only preview of the customer tracker for an agent (K-05): the same body, no customer links, no actions. */
export default async function CustomerViewPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const agent = await requireAgentPage(`/admin/returns/${rawId}/customer-view`);
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) notFound();

  const detail = await loadDetail(id);

  return (
    <AdminShell agent={agent}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <Link href={`/admin/returns/${id}`} className="text-sm underline underline-offset-4">
          {copy.backToCard}
        </Link>
        <Alert variant="info">
          <AlertTitle>{copy.bannerTitle}</AlertTitle>
          <AlertDescription>{copy.bannerDescription}</AlertDescription>
        </Alert>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">{copy.customerHeading}</h1>
          <p className="text-sm">
            {copy.reference}: <strong className="font-mono text-base">{detail.request.rma}</strong>
          </p>
        </header>
        <div className="space-y-8">
          <TrackerBody detail={detail} />
        </div>
      </main>
    </AdminShell>
  );
}
