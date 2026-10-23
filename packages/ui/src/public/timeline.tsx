import type { ReactElement } from "react";

export interface TimelineEvent {
  id: string | number;
  label: string;
  actor: string;
  /** Pre-formatted by the caller: `ui` does no date formatting. */
  at: string;
  note?: string;
}

/** Customer-facing events as an ordered list, oldest first (the newest is last). Same props as the admin timeline. */
export function Timeline({ events, emptyMessage }: { events: TimelineEvent[]; emptyMessage: string }): ReactElement {
  if (events.length === 0) return <p className="py-2 text-sm text-muted-foreground">{emptyMessage}</p>;

  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[1.3125rem] top-1.5 size-2 rounded-full bg-primary" />
          <p className="text-sm font-medium text-foreground">{event.label}</p>
          <p className="text-xs text-muted-foreground">
            {event.actor} · {event.at}
          </p>
          {event.note && <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm text-foreground">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}
