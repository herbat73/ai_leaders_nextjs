import type { Rule } from "./rule.schema";

/** R08–R10 from the product brief, as data. Thresholds are in minor units (grosze). */
export const BRIEF_RULES: Rule[] = [
  {
    schemaVersion: 1,
    id: "R08",
    name: "Zwrot do 150 zł: automatyczna akceptacja",
    enabled: true,
    order: 1,
    when: [
      { type: "kind_in", kinds: ["return"] },
      { type: "value_lte", amountMinor: 15000, tunable: true },
    ],
    then: [{ type: "auto_approve" }],
  },
  {
    schemaVersion: 1,
    id: "R09",
    name: "Reklamacja lub szkoda do 60 zł: klient zatrzymuje towar",
    enabled: true,
    order: 2,
    when: [
      { type: "kind_in", kinds: ["complaint", "transport"] },
      { type: "value_lte", amountMinor: 6000, tunable: true },
    ],
    then: [{ type: "keep_item" }],
  },
  {
    schemaVersion: 1,
    id: "R10a",
    name: "Szkoda transportowa: wysoki priorytet",
    enabled: true,
    order: 3,
    when: [{ type: "kind_in", kinds: ["transport"] }],
    then: [{ type: "high_priority" }],
  },
  {
    schemaVersion: 1,
    id: "R10b",
    name: "Reklamacja elektroniki lub AGD: wymagaj wideo",
    enabled: true,
    order: 4,
    when: [
      { type: "kind_in", kinds: ["complaint"] },
      { type: "category_in", categories: ["electronics", "appliances"] },
    ],
    then: [{ type: "require_evidence", evidence: "video" }],
  },
  {
    schemaVersion: 1,
    id: "R10c",
    name: "Wartość od 2000 zł: przypisz do kierownika",
    enabled: true,
    order: 5,
    when: [{ type: "value_gte", amountMinor: 200000 }],
    then: [{ type: "assign", to: "manager" }],
  },
];
