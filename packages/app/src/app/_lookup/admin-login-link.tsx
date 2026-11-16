import Link from "next/link";
import type { ReactElement } from "react";

import { showAdminLoginLink } from "./admin-login-visibility";
import { lookupCopy as copy } from "./copy";

/** Server Component: dev-only shortcut to `/admin/login`, fixed left of the theme switch (`ThemeToggle`, `right-4`, 36 px). */
export function AdminLoginLink(): ReactElement | null {
  if (!showAdminLoginLink(process.env.NODE_ENV)) return null;
  return (
    <Link
      href="/admin/login"
      className="fixed right-16 top-4 z-50 inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-sm text-card-foreground shadow-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
    >
      {copy.adminLogin}
    </Link>
  );
}
