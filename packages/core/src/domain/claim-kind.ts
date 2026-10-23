export const CLAIM_KINDS = ["return", "complaint", "transport", "missing"] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];
