import { addMoney, formatMoney, money, multiplyMoney, type Money } from "../../domain/money";
import { formatDatePl } from "../../calendar/format-date-pl";
import type { ReturnItem } from "../returns/types";

export interface ClaimComposition {
  rma: string;
  orderNumber: string;
  items: ReturnItem[];
  defectDescription: string;
  /** `YYYY-MM-DD`. */
  defectDiscoveredOn: string | null;
  supplierName: string;
  agentNote: string | null;
  agent: { displayName: string; email: string };
}

const SUBJECT_ITEM_MAX = 60;

/** What the vendor is told the claim is worth: the goods value of the complained items (an upper bound for a credit note). */
export function claimedValue(items: readonly Pick<ReturnItem, "quantity" | "unitPrice">[]): Money {
  return items.reduce((sum, item) => addMoney(sum, multiplyMoney(item.unitPrice, item.quantity)), money(0));
}

/**
 * The claim e-mail in Polish (D07): a subject and a plain-text body. It names the complaint, order, products, serial
 * numbers and the defect as the customer described it, and says the defect was confirmed on receipt. It never carries
 * the customer's e-mail address. Pure; the claim service stores the result so the sent text can be audited.
 */
export function composeSupplierClaim(input: ClaimComposition): { subject: string; body: string } {
  const first = input.items[0]?.name ?? "produkt";
  const shortName = first.length > SUBJECT_ITEM_MAX ? `${first.slice(0, SUBJECT_ITEM_MAX - 1)}…` : first;
  const more = input.items.length > 1 ? ` (+${input.items.length - 1})` : "";
  const subject = `Reklamacja ${input.rma}: ${shortName}${more}`;

  const lines = input.items.map((item) => {
    const parts = [`${item.name} (SKU: ${item.sku})`, `${item.quantity} szt.`, `cena jedn. ${formatMoney(item.unitPrice)}`];
    if (item.serialNumber) parts.push(`numer seryjny: ${item.serialNumber}`);
    return `- ${parts.join(", ")}`;
  });
  const discovered = input.defectDiscoveredOn ? formatDatePl(new Date(`${input.defectDiscoveredOn}T12:00:00Z`)) : null;

  const body = [
    "Szanowni Państwo,",
    "zgłaszamy reklamację wadliwego produktu zakupionego w naszym sklepie.",
    [`Numer zgłoszenia (RMA): ${input.rma}`, `Numer zamówienia: ${input.orderNumber}`, `Wartość reklamowanych produktów: ${formatMoney(claimedValue(input.items))}`].join("\n"),
    ["Reklamowane produkty:", ...lines].join("\n"),
    ["Opis wady podany przez klienta:", input.defectDescription, ...(discovered ? [`Wada zauważona: ${discovered}`] : [])].join("\n"),
    "Po odebraniu produktu wada została przez nas potwierdzona.",
    ...(input.agentNote ? [`Uwagi: ${input.agentNote}`] : []),
    `Prosimy o odpowiedź na tę wiadomość (trafi do: ${input.agent.displayName}, ${input.agent.email}): uznanie lub odrzucenie reklamacji z uzasadnieniem oraz kwota noty kredytowej.`,
    `Z poważaniem,\n${input.agent.displayName}`,
  ].join("\n\n");

  return { subject, body };
}
