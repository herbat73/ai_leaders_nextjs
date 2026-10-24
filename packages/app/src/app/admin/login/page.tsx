import { redirect } from "next/navigation";
import { sanitizeAdminNext } from "@easyrms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easyrms/ui/admin";

import { getCurrentAgent } from "@/server/agent-auth";
import { loginCopy as copy } from "./copy";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = sanitizeAdminNext((await searchParams).next);
  // A signed-in agent has nothing to do here.
  if (await getCurrentAgent()) redirect(next);

  return (
    <main className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm next={next} />
          <p className="text-sm text-muted-foreground">{copy.forgotPassword}</p>
        </CardContent>
      </Card>
    </main>
  );
}
