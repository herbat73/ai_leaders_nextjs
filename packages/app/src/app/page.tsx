import type { ReactElement } from "react";

import { AdminLoginLink } from "./_lookup/admin-login-link";
import { lookupCopy as copy } from "./_lookup/copy";
import { DevSamples } from "./_lookup/dev-samples";
import { LookupForm } from "./_lookup/lookup-form";

export default function LookupPage(): ReactElement {
  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-16">
      <AdminLoginLink />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.intro}</p>
      </header>
      <LookupForm />
      <DevSamples />
    </main>
  );
}
