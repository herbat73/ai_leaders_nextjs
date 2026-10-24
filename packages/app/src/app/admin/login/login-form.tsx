"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { agentLoginSchema } from "@easyrms/core";
import { apiCall, CrudForm, type CrudFormField } from "@easyrms/ui/admin";

import { loginCopy as copy } from "./copy";

const fields: CrudFormField[] = [
  { name: "email", label: copy.email, type: "email", autoComplete: "username" },
  { name: "password", label: copy.password, type: "password", autoComplete: "current-password" },
];

/** Polish messages for the format checks of the shared schema (its own messages are English). */
function validate(values: Record<string, string>): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!values.email.trim()) errors.email = copy.emailRequired;
  else if (!agentLoginSchema.safeParse({ email: values.email, password: "x" }).success) errors.email = copy.emailInvalid;
  if (!values.password) errors.password = copy.passwordRequired;
  return Object.keys(errors).length > 0 ? errors : null;
}

function messageFor(status: number, code: string): string {
  if (code === "invalid_credentials") return copy.invalidCredentials;
  if (status === 429) return copy.rateLimited;
  if (status === 503) return copy.busy;
  return copy.genericError;
}

/** Client island: posts the credentials, then goes to `next` (already sanitized by the server page). */
export function LoginForm({ next }: { next: string }): ReactElement {
  const router = useRouter();

  return (
    <CrudForm
      fields={fields}
      validate={validate}
      submitLabel={copy.submit}
      pendingLabel={copy.pending}
      showPasswordLabel={copy.showPassword}
      hidePasswordLabel={copy.hidePassword}
      onSubmit={async (values) => {
        const result = await apiCall("/api/agents/login", {
          method: "POST",
          body: { email: values.email, password: values.password },
        });
        if (!result.ok) return { form: messageFor(result.status, result.error.code) };
        router.replace(next);
        router.refresh();
        return null;
      }}
    />
  );
}
