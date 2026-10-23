import { z } from "zod";

import { CLAIM_KINDS } from "../domain/claim-kind";
import { PRODUCT_CATEGORIES } from "../domain/claim-facts";

const amountMinor = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Closed, provisional condition vocabulary: JSON-serializable so a rule builder can store and render it later. */
export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kind_in"), kinds: z.array(z.enum(CLAIM_KINDS)).min(1) }),
  z.object({ type: z.literal("category_in"), categories: z.array(z.enum(PRODUCT_CATEGORIES)).min(1) }),
  z.object({ type: z.literal("value_lte"), amountMinor, tunable: z.boolean().optional() }),
  z.object({ type: z.literal("value_gte"), amountMinor, tunable: z.boolean().optional() }),
]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auto_approve") }),
  z.object({ type: z.literal("keep_item") }),
  z.object({ type: z.literal("high_priority") }),
  z.object({ type: z.literal("assign"), to: z.literal("manager") }),
  z.object({ type: z.literal("require_evidence"), evidence: z.literal("video") }),
]);

export const ruleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int(),
  when: z.array(conditionSchema),
  then: z.array(actionSchema).min(1),
});

export type Condition = z.infer<typeof conditionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Rule = z.infer<typeof ruleSchema>;

/** Actions that settle a case without an agent (R10's routing actions do not). */
export const SETTLING_ACTIONS: ReadonlyArray<Action["type"]> = ["auto_approve", "keep_item"];

export function settles(actions: Action[]): boolean {
  return actions.some((action) => SETTLING_ACTIONS.includes(action.type));
}
