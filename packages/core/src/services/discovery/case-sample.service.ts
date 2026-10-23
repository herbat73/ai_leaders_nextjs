import { CLAIM_KINDS, type ClaimKind } from "../../domain/claim-kind";
import type { ClaimFacts } from "../../domain/claim-facts";
import { formatMoney } from "../../domain/money";
import { ValidationError } from "../../errors";
import { groupBy, median, percentile, share } from "../../metrics";
import { BRIEF_RULES } from "../../rules/brief-rules";
import { describeRule } from "../../rules/describe";
import { settles, type Rule } from "../../rules/rule.schema";
import { simulate } from "../../rules/simulate";
import { withThresholds } from "../../rules/with-thresholds";
import { parseTable, looksLikePersonalData, type TableError } from "../../tabular";
import {
  CASE_SAMPLE_CHANNELS,
  CASE_SAMPLE_OUTCOMES,
  caseSampleRowSchema,
  type CaseSampleRow,
} from "../../validators/discovery/case-sample-row.schema";
import type { CaseSampleAnalyzeInput } from "../../validators/discovery/case-sample-analyze.schema";
import { renderCaseSampleNote } from "./case-sample-note";
import type { Agreement, BreakdownRow, CaseSampleReport, CaseView, RuleBlock, RuleDefinitionView } from "./case-sample.types";

const MAX_ROWS = 500;
const MAX_LISTED_ERRORS = 50;
const DAY_MS = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** `row.<line>.<column>` keys, at most 50, plus a `form` remainder; `row.<line>` or `form` for file-level problems. */
function toFieldErrors(errors: TableError[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const listed = errors.slice(0, MAX_LISTED_ERRORS);
  for (const error of listed) {
    const key = error.line === 0 ? "form" : `row.${error.line}${error.column ? `.${error.column}` : ""}`;
    fieldErrors[key] ??= error.message;
  }
  if (errors.length > listed.length) fieldErrors.form = `Jeszcze ${errors.length - listed.length} błędów`;
  return fieldErrors;
}

function definitionsOf(rules: Rule[]): RuleDefinitionView[] {
  return rules.map((rule) => ({ id: rule.id, name: rule.name, ...describeRule(rule) }));
}

function factsOf(row: CaseSampleRow): ClaimFacts {
  return { kind: row.kind, value: row.value_pln, categories: [row.category] };
}

function agreementOf(rows: CaseSampleRow[], rules: Rule[], perCase: { ruleId: string }[][]): Agreement {
  const settling = new Map(rules.map((rule) => [rule.id, rule]));
  const result: Agreement = { agrees: 0, falseApprovals: 0, other: 0 };
  rows.forEach((row, index) => {
    const matched = (perCase[index] ?? []).map((m) => settling.get(m.ruleId)).filter((r): r is Rule => !!r && settles(r.then));
    if (matched.length === 0) return;
    if (row.outcome === "cancelled" || row.outcome === "open") result.other += 1;
    else if (row.outcome === "rejected") result.falseApprovals += 1;
    else {
      const approves = matched.some((rule) => rule.then.some((a) => a.type === "auto_approve"));
      // `partial` agrees with keep_item but is neither agreement nor a false approval for auto_approve.
      if (row.outcome === "approved" || (row.outcome === "partial" && !approves)) result.agrees += 1;
      else result.other += 1;
    }
  });
  return result;
}

function ruleBlock(rows: CaseSampleRow[], rules: Rule[]): { block: RuleBlock; perCase: { ruleId: string }[][] } {
  const sim = simulate(rows.map(factsOf), rules);
  const settledResolved = rows.filter((row, i) => row.resolved_on !== null && (sim.perCase[i] ?? []).some((m) => {
    const rule = rules.find((r) => r.id === m.ruleId);
    return rule !== undefined && settles(rule.then);
  })).length;
  const resolved = rows.filter((row) => row.resolved_on !== null).length;
  return {
    perCase: sim.perCase,
    block: {
      settledShare: share(sim.settled, sim.total),
      settledShareResolved: share(settledResolved, resolved),
      matchedByRule: sim.matchedByRule,
      agreement: agreementOf(rows, rules, sim.perCase),
    },
  };
}

function breakdown<K extends string>(rows: CaseSampleRow[], key: (row: CaseSampleRow) => K, order: readonly K[], withValue = false): BreakdownRow[] {
  const groups = groupBy(rows, key);
  return order
    .filter((label) => groups.has(label))
    .map((label) => {
      const group = groups.get(label) as CaseSampleRow[];
      const row: BreakdownRow = { label, count: group.length, share: group.length / rows.length };
      if (withValue) {
        const mid = median(group.map((r) => r.value_pln.amountMinor));
        if (mid !== null) row.valueMedian = formatMoney({ amountMinor: Math.round(mid), currency: "PLN" });
      }
      return row;
    });
}

/** Stateless analysis of an anonymised case sample: nothing is stored, nothing touches the database. */
export class CaseSampleService {
  analyze(input: CaseSampleAnalyzeInput): CaseSampleReport {
    const parsed = parseTable(input.csv, caseSampleRowSchema, { maxRows: MAX_ROWS, cellGuard: looksLikePersonalData });
    if (!parsed.ok) throw new ValidationError("Plik CSV zawiera błędy", toFieldErrors(parsed.errors));

    const seen = new Set<string>();
    const duplicates: TableError[] = [];
    for (const { line, value } of parsed.rows) {
      const ref = value.case_ref.toLowerCase();
      if (seen.has(ref)) duplicates.push({ line, column: "case_ref", message: "Powtórzony numer sprawy" });
      seen.add(ref);
    }
    if (duplicates.length > 0) throw new ValidationError("Plik CSV zawiera błędy", toFieldErrors(duplicates));

    const rows = parsed.rows.map((r) => r.value);
    const n = rows.length;
    const followUps = rows.map((r) => r.follow_up_requests);
    const messages = rows.map((r) => r.messages_exchanged);
    const resolvedRows = rows.filter((r) => r.resolved_on !== null);

    const baselineRules = BRIEF_RULES;
    const baseline = ruleBlock(rows, baselineRules);
    const definitions = definitionsOf(baselineRules);

    let whatIf: CaseSampleReport["rules"]["whatIf"] = null;
    if (input.thresholds && Object.keys(input.thresholds).length > 0) {
      const tuned = withThresholds(baselineRules, input.thresholds as Record<string, number>);
      whatIf = { ...ruleBlock(rows, tuned).block, definitions: definitionsOf(tuned) };
    }

    const days = groupBy(resolvedRows, (r) => r.kind);
    const daysMedianByKind: Partial<Record<ClaimKind, number>> = {};
    for (const kind of CLAIM_KINDS) {
      const group = days.get(kind);
      const mid = group ? median(group.map((r) => daysBetween(r.opened_on, r.resolved_on as string))) : null;
      if (mid !== null) daysMedianByKind[kind] = mid;
    }

    const months = rows.flatMap((r) => [r.opened_on.slice(0, 7), (r.resolved_on ?? r.opened_on).slice(0, 7)]).sort();
    const cases: CaseView[] = rows.map((row, i) => ({
      id: `C${String(i + 1).padStart(2, "0")}`,
      kind: row.kind,
      channel: row.channel,
      value: formatMoney(row.value_pln),
      valueMinor: row.value_pln.amountMinor,
      month: row.opened_on.slice(0, 7),
      followUps: row.follow_up_requests,
      messages: row.messages_exchanged,
      daysToResolve: row.resolved_on === null ? null : daysBetween(row.opened_on, row.resolved_on),
      outcome: row.outcome,
      rules: (baseline.perCase[i] ?? []).map((m) => m.ruleId),
    }));

    const report: CaseSampleReport = {
      sampleSize: n,
      period: { from: months[0] as string, to: months[months.length - 1] as string },
      droppedColumns: parsed.droppedColumns,
      followUp: {
        share: share(rows.filter((r) => r.follow_up_requests >= 1).length, n) as NonNullable<ReturnType<typeof share>>,
        messagesMedian: median(messages),
        messagesP75: percentile(messages, 0.75),
        followUpsMedian: median(followUps),
      },
      resolution: { resolved: resolvedRows.length, open: n - resolvedRows.length, daysMedianByKind },
      byKind: breakdown(rows, (r) => r.kind, CLAIM_KINDS, true),
      byChannel: breakdown(rows, (r) => r.channel, CASE_SAMPLE_CHANNELS),
      byOutcome: breakdown(rows, (r) => r.outcome, CASE_SAMPLE_OUTCOMES),
      rules: { baseline: baseline.block, whatIf, definitions },
      cases,
      note: "",
    };
    report.note = renderCaseSampleNote(report);
    return report;
  }
}
