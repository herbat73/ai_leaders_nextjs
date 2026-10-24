import type { ReactElement, ReactNode } from "react";

/** Renders `code` spans inside plain strings passed as props (MDX does not parse markdown inside JSX attributes). */
function Inline({ text }: { text: string }): ReactElement {
  return (
    <>
      {text.split("`").map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Two columns for the "Rób i nie rób" section of every docs page. Marked by a heading word, never by colour alone. */
export function DoDont({ rob, nieRob }: { rob: string[]; nieRob: string[] }): ReactElement {
  return (
    <div className="not-prose my-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-success-subtle-border bg-success-subtle p-4 text-sm text-success-subtle-foreground">
        <p className="mb-2 font-semibold">✓ Rób</p>
        <ul className="list-disc space-y-1 pl-5">
          {rob.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-destructive-subtle-border bg-destructive-subtle p-4 text-sm text-destructive-subtle-foreground">
        <p className="mb-2 font-semibold">✕ Nie rób</p>
        <ul className="list-disc space-y-1 pl-5">
          {nieRob.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One colour token: a live swatch (so it follows the light/dark switch), the CSS variable, the Tailwind class and the role. */
export function Swatch({ token, role, foreground }: { token: string; role: string; foreground?: string }): ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 text-sm text-card-foreground">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border text-xs font-semibold"
        style={{ background: `var(--${token})`, color: foreground ? `var(--${foreground})` : undefined }}
      >
        {foreground ? "Aa" : ""}
      </span>
      <span className="min-w-0">
        <code className="block font-mono text-xs">--{token}</code>
        <span className="block text-muted-foreground">
          <Inline text={role} />
        </span>
      </span>
    </div>
  );
}

export function SwatchGrid({ children }: { children: ReactNode }): ReactElement {
  return <div className="not-prose my-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** A tone as the reader meets it: solid, subtle surface, and the badge/alert built from them. */
export function ToneRow({ tone, meaning }: { tone: "success" | "warning" | "info" | "destructive"; meaning: string }): ReactElement {
  return (
    <div className="not-prose my-2 grid items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm sm:grid-cols-[8rem_1fr_1fr_1fr]">
      <span className="font-semibold">{tone}</span>
      <span className="text-muted-foreground">{meaning}</span>
      <span
        className="rounded-md px-3 py-2 text-center font-medium"
        style={{ background: `var(--${tone})`, color: `var(--${tone}-foreground)` }}
      >
        solid
      </span>
      <span
        className="rounded-md border px-3 py-2 text-center font-medium"
        style={{
          background: `var(--${tone}-subtle)`,
          color: `var(--${tone}-subtle-foreground)`,
          borderColor: `var(--${tone}-subtle-border)`,
        }}
      >
        subtle
      </span>
    </div>
  );
}
