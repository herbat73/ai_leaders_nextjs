import type { StoredReturnStatus } from "@easyrms/core";

/** Polish status labels for customer pages (tracker, overview); stored values stay language-neutral. */
export const statusLabels = {
  submitted: "Zgłoszone",
  awaiting_customer: "Oczekuje na Twoją odpowiedź",
  approved: "Zatwierdzone",
  in_transit: "W drodze",
  received: "Odebrane",
  in_service: "W sprawdzaniu",
  resolved: "Zakończone",
  rejected: "Odrzucone",
  cancelled: "Anulowane",
  unknown: "Nieznany",
} as const satisfies Record<StoredReturnStatus, string>;
