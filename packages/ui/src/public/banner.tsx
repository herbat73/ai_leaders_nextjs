import type { ReactElement, ReactNode } from "react";

export type BannerTone = "info" | "success" | "warning" | "error";

const toneClass: Record<BannerTone, string> = {
  info: "border-info-subtle-border bg-info-subtle text-info-subtle-foreground",
  success: "border-success-subtle-border bg-success-subtle text-success-subtle-foreground",
  warning: "border-warning-subtle-border bg-warning-subtle text-warning-subtle-foreground",
  error: "border-destructive-subtle-border bg-destructive-subtle text-destructive-subtle-foreground",
};

/** Info and success are a polite `status`, warning and error are an assertive `alert`. */
export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }): ReactElement {
  return (
    <div role={tone === "info" || tone === "success" ? "status" : "alert"} className={`rounded-md border px-4 py-3.5 text-sm ${toneClass[tone]}`}>
      {children}
    </div>
  );
}
