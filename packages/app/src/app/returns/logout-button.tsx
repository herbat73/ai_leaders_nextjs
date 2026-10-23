"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { apiCall } from "@easyrms/ui/admin";

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
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
      >
        {pending ? copy.loggingOut : copy.logout}
      </button>
      {failed && (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {copy.logoutFailed}
        </p>
      )}
    </div>
  );
}
