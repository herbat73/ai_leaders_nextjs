import type { ReactElement, ReactNode } from "react";

export type BannerTone = "info" | "warning" | "error";

const toneClass: Record<BannerTone, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
};

/** Info is a polite `status`, warning and error are an assertive `alert`. */
export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }): ReactElement {
  return (
    <div role={tone === "info" ? "status" : "alert"} className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      {children}
    </div>
  );
}
