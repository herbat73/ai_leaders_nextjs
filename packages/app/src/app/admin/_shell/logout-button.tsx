"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { apiCall, Button } from "@easyrms/ui/admin";

import { shellCopy as copy } from "./copy";

/** Client island: ends the agent session (cookie cleared by the server), then returns to the login page. */
export function LogoutButton(): ReactElement {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout(): Promise<void> {
    setPending(true);
    setFailed(false);
    const result = await apiCall("/api/agents/logout", { method: "POST" });
    // 401 means the session was already gone, which is what the agent wanted.
    if (!result.ok && result.status !== 401) {
      setFailed(true);
      setPending(false);
      return;
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={logout} disabled={pending}>
        {pending ? copy.loggingOut : copy.logout}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {copy.logoutFailed}
        </p>
      )}
    </div>
  );
}
