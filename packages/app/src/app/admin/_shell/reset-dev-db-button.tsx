"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import {
  apiCall,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@easyrms/ui/admin";

import { shellCopy as copy } from "./copy";

/**
 * Development only (issue #174; `AdminShell` renders it only when `isDevResetAvailableHere()`): after a confirmation,
 * empties the database and reseeds the dev data. The reset deletes the signed-in agent too, so on success the session
 * is gone and the page goes to the login page. The route re-checks the environment; hiding this button is a convenience.
 */
export function ResetDevDbButton(): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reset(): Promise<void> {
    setPending(true);
    setFailed(false);
    const result = await apiCall("/api/dev/reset", { method: "POST" });
    if (!result.ok) {
      setFailed(true);
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {copy.resetDb}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.resetDbTitle}</DialogTitle>
          <DialogDescription>{copy.resetDbQuestion}</DialogDescription>
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {copy.resetDbFailed}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending} autoFocus>
              {copy.resetDbCancel}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={reset} disabled={pending}>
            {pending ? copy.resettingDb : copy.resetDbConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
