import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easyrms/ui/admin";

import { inviteCopy as copy } from "./copy";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

// The token is in the path: keep it out of any `Referer` (also sent as a header, see `next.config.ts`), and out of indexes.
export const metadata: Metadata = { title: copy.title, referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function AdminInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
