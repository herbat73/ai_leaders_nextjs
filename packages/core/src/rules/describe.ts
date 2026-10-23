import { formatMoney } from "../domain/money";
import type { ClaimKind } from "../domain/claim-kind";
import type { ProductCategory } from "../domain/claim-facts";
import { settles, type Action, type Condition, type Rule } from "./rule.schema";

// Polish only (decision D07); `ui` has no strings, so the text is built here.
const KIND_TEXT: Record<ClaimKind, string> = {
  return: "zwrot",
  complaint: "reklamacja",
  transport: "szkoda transportowa",
  missing: "brak w przesyłce",
};

const CATEGORY_TEXT: Record<ProductCategory, string> = {
  electronics: "elektronika",
  appliances: "AGD",
  home: "dom",
  clothing: "odzież",
  hygiene: "higiena",
  other: "inne",
};

function describeCondition(condition: Condition): string {
  switch (condition.type) {
    case "kind_in":
      return `rodzaj: ${condition.kinds.map((kind) => KIND_TEXT[kind]).join(", ")}`;
    case "category_in":
      return `kategoria: ${condition.categories.map((category) => CATEGORY_TEXT[category]).join(", ")}`;
    case "value_lte":
      return `wartość ≤ ${formatMoney({ amountMinor: condition.amountMinor, currency: "PLN" })}`;
    case "value_gte":
      return `wartość ≥ ${formatMoney({ amountMinor: condition.amountMinor, currency: "PLN" })}`;
  }
}

function describeAction(action: Action): string {
  switch (action.type) {
    case "auto_approve":
      return "automatyczna akceptacja";
    case "keep_item":
      return "klient zatrzymuje towar";
    case "high_priority":
      return "wysoki priorytet";
    case "assign":
      return "przypisz do kierownika";
    case "require_evidence":
      return "wymagaj nagrania wideo";
  }
}

export function describeRule(rule: Rule): { conditions: string[]; actions: string[]; settles: boolean } {
  return {
    conditions: rule.when.map(describeCondition),
    actions: rule.then.map(describeAction),
    settles: settles(rule.then),
  };
}
