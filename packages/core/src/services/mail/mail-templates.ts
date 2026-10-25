import type { MailMessage } from "./mail.port";

export interface RenderedMail {
  subject: string;
  text: string;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const STATUS_PL: Record<string, string> = {
  submitted: "zgłoszone",
  awaiting_customer: "oczekuje na Twoją odpowiedź",
  approved: "zatwierdzone",
  in_transit: "w drodze",
  received: "odebrane",
  in_service: "w sprawdzaniu",
  resolved: "zakończone",
  rejected: "odrzucone",
  cancelled: "anulowane",
};

/**
 * Polish plain-text body and subject for a mail (D07). Pure and total: a missing variable renders as an empty string,
 * so a malformed `data` never throws. Customer mails carry the RMA and status only (never the decision note); the
 * supplier claim is composed by the claim service, which owns its text, and is rendered as given.
 */
export function renderMail(message: Pick<MailMessage, "template" | "data">): RenderedMail {
  const { data } = message;
  switch (message.template) {
    case "return_submitted": {
      const complaint = data.kind === "complaint";
      return {
        subject: `${complaint ? "Reklamacja" : "Zwrot"} przyjęta – ${str(data.rma)}`,
        text: [
          `Dziękujemy, ${complaint ? "reklamacja została przyjęta" : "zgłoszenie zwrotu zostało przyjęte"}.`,
          `Numer zgłoszenia (RMA): ${str(data.rma)}`,
          "Odpowiemy w ciągu 2 dni roboczych. Status sprawdzisz w portalu, podając numer zamówienia i e-mail.",
        ].join("\n\n"),
      };
    }
    case "return_status_changed": {
      const status = STATUS_PL[str(data.status)] ?? "zmieniony";
      return {
        subject: `Zmiana statusu zgłoszenia ${str(data.rma)}`,
        text: [`Status Twojego zgłoszenia ${str(data.rma)} to: ${status}.`, "Szczegóły sprawdzisz w portalu, podając numer zamówienia i e-mail."].join("\n\n"),
      };
    }
    case "agent_invite": {
      const url = str(data.inviteUrl);
      return {
        subject: "Zaproszenie do panelu obsługi EasyRMS",
        text: [
          `Cześć ${str(data.displayName)},`,
          url ? `Ustaw hasło i aktywuj konto pod tym adresem: ${url}` : "Skontaktuj się z osobą, która Cię zaprosiła, po link aktywacyjny.",
          `Zaproszenie wygasa: ${str(data.expiresAt)}.`,
        ].join("\n\n"),
      };
    }
    case "supplier_claim":
      return { subject: str(data.subject), text: str(data.body) };
  }
}
