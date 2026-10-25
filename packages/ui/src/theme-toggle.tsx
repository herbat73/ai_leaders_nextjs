"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fixed-corner light/dark switch. Toggles the `dark` class on <html> and remembers the choice in localStorage. */
export function ThemeToggle(): React.JSX.Element {
  // The class on <html> is the source of truth (set by the inline pre-paint script); the server snapshot is light.
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false);

  function toggle(): void {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode): the theme still switches for this visit.
    }
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="fixed right-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
