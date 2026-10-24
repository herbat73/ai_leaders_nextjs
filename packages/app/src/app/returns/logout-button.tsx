"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { apiCall } from "@easyrms/ui/api";
import { ActionButton } from "@easyrms/ui/public";

import { overviewCopy as copy } from "./copy";

/** Client island: ends the guest session, then returns to the lookup page. */
export function LogoutButton(): ReactElement {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout(): Promise<void> {
    setPending(true);
    setFailed(false);
    const result = await apiCall("/api/returns/session", { method: "DELETE" });
    if (!result.ok) {
      setFailed(true);
      setPending(false);
      return;
    }
    router.push("/");
  }

  return (
    <div className="text-right">
      <ActionButton variant="link" onClick={logout} disabled={pending}>
        {pending ? copy.loggingOut : copy.logout}
      </ActionButton>
      {failed && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {copy.logoutFailed}
        </p>
      )}
    </div>
  );
}
