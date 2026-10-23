import type { ClaimKind } from "./claim-kind";
import type { Money } from "./money";

export const PRODUCT_CATEGORIES = ["electronics", "appliances", "home", "clothing", "hygiene", "other"] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Normalized rule input. Later specs add reasons, days since delivery and supplier. */
export interface ClaimFacts {
  kind: ClaimKind;
  value: Money;
  categories: ProductCategory[];
}
