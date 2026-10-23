import type { Interval } from "../../metrics";
import type { CaseSampleReport } from "./case-sample.types";

// Polish only (decision D07).
const KIND = { return: "Zwrot", complaint: "Reklamacja", transport: "Szkoda transportowa", missing: "Brak w przesyłce" } as const;
const CHANNEL = { mail: "E-mail", phone: "Telefon" } as const;
const OUTCOME = {
  approved: "Zaakceptowane",
  rejected: "Odrzucone",
  partial: "Częściowo",
  cancelled: "Anulowane",
  open: "Otwarte",
} as const;

const DASH = "—";

function num(value: number | null): string {
  return value === null ? DASH : String(Math.round(value * 100) / 100).replace(".", ",");
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function interval(i: Interval | null): string {
  return i === null ? DASH : `${pct(i.value)} (${pct(i.low)}–${pct(i.high)})`;
}

/** Value bands instead of exact amounts, so the committed note is harder to match back to an order. */
export function valueBand(amountMinor: number): string {
  if (amountMinor <= 6000) return "≤ 60 zł";
  if (amountMinor <= 15000) return "60–150 zł";
  if (amountMinor <= 50000) return "150–500 zł";
  if (amountMinor <= 200000) return "500–2000 zł";
  return "> 2000 zł";
}

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? month} ${year}`;
}

function table(headers: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** Renders the pseudonymised `[DATA]` research note. Never contains a `case_ref`, exact amount or exact day. */
export function renderCaseSampleNote(report: CaseSampleReport, date: Date = new Date()): string {
  const { followUp, resolution, rules } = report;
  const settledDefinitions = rules.definitions.filter((d) => d.settles).map((d) => d.id).join(", ");
  const period =
    report.period.from === report.period.to
      ? monthLabel(report.period.from)
      : `${monthLabel(report.period.from)} – ${monthLabel(report.period.to)}`;
  const channels = report.byChannel.map((r) => `${CHANNEL[r.label as keyof typeof CHANNEL]}: ${r.count}`).join(", ");
  const baselineAgreement = rules.baseline.agreement;

  const lines: string[] = [
    "# Próba przypadków — follow-upy i pokrycie regułami [DATA]",
    "",
    `- Data: ${date.toISOString().slice(0, 10)}`,
    `- Liczba spraw (n): ${report.sampleSize}`,
    `- Okres (miesiące): ${period}`,
    `- Kanały: ${channels}`,
    "- Właściciel: kierownik obsługi klienta",
    "- Źródło: anonimowa próba, zebrana z historii e-maili i rozmów telefonicznych",
    "",
    "## A01 — follow-upy są głównym kosztem obsługi",
    "",
    `- Sprawy z co najmniej jednym dopytaniem: **${interval(followUp.share)}** (przedział ufności 95%, Wilson)`,
    `- Wiadomości w sprawie: mediana ${num(followUp.messagesMedian)}, 75. percentyl ${num(followUp.messagesP75)}`,
    `- Dopytania w sprawie: mediana ${num(followUp.followUpsMedian)}`,
    "- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).",
    "",
    "## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami",
    "",
    `- Rozstrzygnięte regułą (${settledDefinitions}), wszystkie sprawy: **${interval(rules.baseline.settledShare)}**, próg hipotezy 35%`,
    `- Rozstrzygnięte regułą, tylko sprawy zamknięte: ${interval(rules.baseline.settledShareResolved)}`,
    `- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne ${baselineAgreement.agrees}, fałszywe akceptacje ${baselineAgreement.falseApprovals}, inne ${baselineAgreement.other}`,
    "- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.",
    "",
    table(
      ["Reguła", "Dopasowania", "Rozstrzyga"],
      rules.definitions.map((d) => [d.id, String(rules.baseline.matchedByRule[d.id] ?? 0), d.settles ? "tak" : "nie"]),
    ),
  ];

  if (rules.whatIf) {
    const w = rules.whatIf;
    lines.push(
      "",
      "### Scenariusz z innymi progami",
      "",
      ...w.definitions.filter((d) => d.settles).map((d) => `- ${d.id}: ${d.conditions.join("; ")}`),
      `- Rozstrzygnięte regułą, wszystkie sprawy: **${interval(w.settledShare)}**`,
      `- Rozstrzygnięte regułą, tylko sprawy zamknięte: ${interval(w.settledShareResolved)}`,
      `- Zgodność: zgodne ${w.agreement.agrees}, fałszywe akceptacje ${w.agreement.falseApprovals}, inne ${w.agreement.other}`,
    );
  }

  const medians = Object.entries(resolution.daysMedianByKind)
    .map(([kind, days]) => `${KIND[kind as keyof typeof KIND]} ${num(days)}`)
    .join(", ");
  lines.push(
    "",
    "## Czas rozstrzygnięcia",
    "",
    `- Sprawy zamknięte: ${resolution.resolved}, otwarte: ${resolution.open} (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)`,
    `- Mediana dni do rozstrzygnięcia wg rodzaju: ${medians === "" ? DASH : medians}`,
    "",
    "## Rozkłady",
    "",
    table(["Rodzaj", "Liczba", "Udział"], report.byKind.map((r) => [KIND[r.label as keyof typeof KIND], String(r.count), pct(r.share)])),
    "",
    table(["Kanał", "Liczba", "Udział"], report.byChannel.map((r) => [CHANNEL[r.label as keyof typeof CHANNEL], String(r.count), pct(r.share)])),
    "",
    table(["Wynik", "Liczba", "Udział"], report.byOutcome.map((r) => [OUTCOME[r.label as keyof typeof OUTCOME], String(r.count), pct(r.share)])),
    "",
    "## Sprawy",
    "",
    table(
      ["Id", "Miesiąc", "Rodzaj", "Kanał", "Wartość", "Dopytania", "Wiadomości", "Dni", "Wynik", "Reguły"],
      report.cases.map((c) => [
        c.id,
        c.month,
        KIND[c.kind],
        CHANNEL[c.channel],
        valueBand(c.valueMinor),
        String(c.followUps),
        String(c.messages),
        c.daysToResolve === null ? DASH : String(c.daysToResolve),
        OUTCOME[c.outcome],
        c.rules.length === 0 ? DASH : c.rules.join(", "),
      ]),
    ),
    "",
    "## Metoda i ograniczenia",
    "",
    "- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.",
    "- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.",
    "- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.",
    "- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.",
    `- Wielkość próby: n = ${report.sampleSize}.`,
    "- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.",
    "- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.",
    "",
  );
  return lines.join("\n");
}
