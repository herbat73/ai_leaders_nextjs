"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { AGENT_PASSWORD_MAX_LENGTH, AGENT_PASSWORD_MIN_LENGTH } from "@easyrms/core";
import { Alert, AlertDescription, AlertTitle, apiCall, CrudForm, type CrudFormField } from "@easyrms/ui/admin";

import { inviteCopy as copy } from "./copy";

const fields: CrudFormField[] = [
  { name: "password", label: copy.password, type: "password", autoComplete: "new-password" },
];

function validate(values: Record<string, string>): Record<string, string> | null {
  if (values.password.length < AGENT_PASSWORD_MIN_LENGTH) return { password: copy.tooShort(AGENT_PASSWORD_MIN_LENGTH) };
  if (values.password.length > AGENT_PASSWORD_MAX_LENGTH) return { password: copy.tooLong(AGENT_PASSWORD_MAX_LENGTH) };
  return null;
}

/** Client island: the token travels in the POST body only, never in a later URL. */
export function InviteForm({ token }: { token: string }): ReactElement {
  const router = useRouter();
  const [invalid, setInvalid] = useState(false);

  if (invalid) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{copy.invalidTitle}</AlertTitle>
        <AlertDescription>{copy.invalid}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{copy.passwordHint}</p>
      <CrudForm
        fields={fields}
        validate={validate}
        submitLabel={copy.submit}
        pendingLabel={copy.pending}
        showPasswordLabel={copy.showPassword}
        hidePasswordLabel={copy.hidePassword}
        onSubmit={async (values) => {
          const result = await apiCall("/api/agents/invite/accept", {
            method: "POST",
            body: { token, password: values.password },
          });
          if (!result.ok) {
            if (result.error.code === "invite_invalid") {
              setInvalid(true);
              return null;
            }
            return { form: result.status === 503 ? copy.busy : copy.genericError };
          }
          router.replace("/admin/returns");
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
