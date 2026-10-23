import type { Interval } from "../../metrics";
import type { CaseSampleChannel, CaseSampleOutcome } from "../../validators/discovery/case-sample-row.schema";
import type { ClaimKind } from "../../domain/claim-kind";

export interface RuleDefinitionView {
  id: string;
  name: string;
  conditions: string[];
  actions: string[];
  settles: boolean;
}

export interface Agreement {
  agrees: number;
  falseApprovals: number;
  other: number;
}

export interface RuleBlock {
  settledShare: Interval | null;
  settledShareResolved: Interval | null;
  matchedByRule: Record<string, number>;
  agreement: Agreement;
}

export interface BreakdownRow {
  label: string;
  count: number;
  /** Share of n, 0–1, no interval. */
  share: number;
  /** Formatted median value, only for the kind breakdown. */
  valueMedian?: string;
}

export interface CaseView {
  /** `C01…Cnn`; the collector's `case_ref` is never echoed. */
  id: string;
  kind: ClaimKind;
  channel: CaseSampleChannel;
  /** Exact amount, pre-formatted; shown on screen only, never in the note. */
  value: string;
  valueMinor: number;
  month: string;
  followUps: number;
  messages: number;
  daysToResolve: number | null;
  outcome: CaseSampleOutcome;
  rules: string[];
}

export interface CaseSampleReport {
  sampleSize: number;
  period: { from: string; to: string };
  droppedColumns: string[];
  followUp: {
    share: Interval;
    messagesMedian: number | null;
    messagesP75: number | null;
    followUpsMedian: number | null;
  };
  resolution: { resolved: number; open: number; daysMedianByKind: Partial<Record<ClaimKind, number>> };
  byKind: BreakdownRow[];
  byChannel: BreakdownRow[];
  byOutcome: BreakdownRow[];
  rules: {
    baseline: RuleBlock;
    whatIf: (RuleBlock & { definitions: RuleDefinitionView[] }) | null;
    definitions: RuleDefinitionView[];
  };
  cases: CaseView[];
  /** Markdown `[DATA]` note, filled by `CaseSampleService.analyze`. */
  note: string;
}
