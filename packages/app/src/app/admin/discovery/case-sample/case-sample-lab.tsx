"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import type { CaseSampleReport, CaseView } from "@easyrms/core";
import {
  apiCall,
  BreakdownTable,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  ErrorMessage,
  FileImport,
  Input,
  Label,
  LoadingMessage,
  StatRow,
  StatTile,
  type DataTableColumn,
} from "@easyrms/ui/admin";

import { labCopy as copy } from "./copy";

type Interval = { value: number; low: number; high: number } | null;

const pct = (value: number): string => `${Math.round(value * 100)}%`;
const num = (value: number | null): string => (value === null ? copy.dash : String(Math.round(value * 100) / 100).replace(".", ","));
const intervalText = (i: Interval): string => (i === null ? copy.dash : `${pct(i.value)} (${pct(i.low)}–${pct(i.high)})`);

interface RowError {
  key: string;
  line: string;
  column: string;
  message: string;
}

/** `row.<line>.<column>` and `row.<line>` keys to a list; anything else (`form`, `thresholds.*`) is a file-level message. */
function toRowErrors(fieldErrors: Record<string, string> | undefined): RowError[] {
  return Object.entries(fieldErrors ?? {}).map(([key, message]) => {
    const match = /^row\.(\d+)(?:\.(.+))?$/.exec(key);
    return { key, line: match?.[1] ?? copy.dash, column: match?.[2] ?? copy.dash, message };
  });
}

const rowErrorColumns: DataTableColumn<RowError>[] = [
  { key: "line", header: copy.rowErrors.line, cell: (e) => e.line },
  { key: "column", header: copy.rowErrors.column, cell: (e) => e.column },
  { key: "message", header: copy.rowErrors.message, cell: (e) => e.message },
];

const caseColumns: DataTableColumn<CaseView>[] = [
  { key: "id", header: copy.cases.columns.id, className: "font-medium", cell: (c) => c.id },
  { key: "kind", header: copy.cases.columns.kind, cell: (c) => copy.kinds[c.kind] },
  { key: "channel", header: copy.cases.columns.channel, cell: (c) => copy.channels[c.channel] },
  { key: "value", header: copy.cases.columns.value, cell: (c) => c.value },
  { key: "followUps", header: copy.cases.columns.followUps, cell: (c) => c.followUps },
  { key: "messages", header: copy.cases.columns.messages, cell: (c) => c.messages },
  { key: "days", header: copy.cases.columns.days, cell: (c) => (c.daysToResolve === null ? copy.dash : c.daysToResolve) },
  { key: "outcome", header: copy.cases.columns.outcome, cell: (c) => copy.outcomes[c.outcome] },
  { key: "rules", header: copy.cases.columns.rules, cell: (c) => (c.rules.length === 0 ? copy.dash : c.rules.join(", ")) },
];

function breakdownRows<K extends string>(rows: { label: string; count: number; share: number }[], labels: Record<K, string>) {
  return rows.map((row) => ({ ...row, label: labels[row.label as K] ?? row.label }));
}

export function CaseSampleLab(): ReactElement {
  const [csv, setCsv] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CaseSampleReport>();
  const [error, setError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [thresholds, setThresholds] = useState({ R08: "", R09: "" });
  const [copyStatus, setCopyStatus] = useState<string>();
  const [thresholdError, setThresholdError] = useState<string>();

  async function analyze(text: string, overrides: Record<string, string>): Promise<void> {
    setLoading(true);
    setError(undefined);
    setRowErrors([]);
    setThresholdError(undefined);
    setCopyStatus(undefined);
    const result = await apiCall<CaseSampleReport>("/api/discovery/case-sample", {
      method: "POST",
      body: Object.keys(overrides).length > 0 ? { csv: text, thresholds: overrides } : { csv: text },
    });
    setLoading(false);
    if (result.ok) {
      setReport(result.data);
      return;
    }
    // A bad threshold keeps the current results so the user can fix the typo without re-uploading.
    const failed = Object.entries(result.error.fieldErrors ?? {}).filter(([key]) => key.startsWith("thresholds."));
    if (report && failed.length > 0) {
      setThresholdError(`${copy.invalidThresholds}: ${failed.map(([key, message]) => `${key.slice(11)} — ${message}`).join("; ")}`);
      return;
    }
    // Map the code to Polish copy instead of showing the server or `apiCall` English text.
    setReport(undefined);
    setError(copy.errors[result.error.code] ?? copy.errors.fallback);
    setRowErrors(toRowErrors(result.error.fieldErrors));
  }

  function onText(text: string): void {
    setCsv(text);
    setThresholds({ R08: "", R09: "" });
    void analyze(text, {});
  }

  function recalculate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!csv) return;
    const overrides = Object.fromEntries(Object.entries(thresholds).filter(([, value]) => value.trim() !== ""));
    void analyze(csv, overrides);
  }

  function download(note: string): void {
    const url = URL.createObjectURL(new Blob([note], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${new Date().toISOString().slice(0, 10)}-case-sample.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyNote(note: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(note);
      setCopyStatus(copy.note.copied);
    } catch {
      setCopyStatus(copy.note.copyFailed);
    }
  }

  const ruleRows = report?.rules.definitions.map((definition) => ({
    id: definition.id,
    settles: definition.settles,
    baseline: report.rules.baseline.matchedByRule[definition.id] ?? 0,
    whatIf: report.rules.whatIf ? (report.rules.whatIf.matchedByRule[definition.id] ?? 0) : null,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <FileImport
            accept=".csv,text/csv"
            maxBytes={512 * 1024}
            label={copy.import.label}
            hint={copy.import.hint}
            disabled={loading}
            messages={copy.import.messages}
            onText={onText}
          />
          {loading && <LoadingMessage message={copy.loading} />}
        </CardContent>
      </Card>

      <p role="status" className="sr-only">
        {report ? copy.ready : ""}
      </p>
      <div className="space-y-6">
        {error && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <ErrorMessage message={error} />
              {rowErrors.length > 0 && (
                <DataTable columns={rowErrorColumns} rows={rowErrors} getRowKey={(e) => e.key} caption={copy.rowErrors.title} />
              )}
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            {report.droppedColumns.length > 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                {copy.droppedColumns(report.droppedColumns)}
              </p>
            )}
            <StatRow>
              <StatTile label={copy.tiles.sample} value={String(report.sampleSize)} />
              <StatTile
                label={copy.tiles.followUp}
                value={pct(report.followUp.share.value)}
                hint={copy.interval(pct(report.followUp.share.low), pct(report.followUp.share.high))}
              />
              <StatTile label={copy.tiles.messages} value={num(report.followUp.messagesMedian)} />
              <StatTile
                label={copy.tiles.settled}
                value={report.rules.baseline.settledShare ? pct(report.rules.baseline.settledShare.value) : copy.dash}
                hint={
                  report.rules.baseline.settledShare
                    ? copy.interval(pct(report.rules.baseline.settledShare.low), pct(report.rules.baseline.settledShare.high))
                    : undefined
                }
              />
            </StatRow>

            <div className="grid gap-6 md:grid-cols-3">
              {(
                [
                  ["kind", report.byKind, copy.kinds],
                  ["channel", report.byChannel, copy.channels],
                  ["outcome", report.byOutcome, copy.outcomes],
                ] as const
              ).map(([key, rows, labels]) => (
                <BreakdownTable
                  key={key}
                  caption={copy.breakdowns[key].caption}
                  columnLabels={{ label: copy.breakdowns[key].label, count: copy.breakdowns.count, share: copy.breakdowns.share }}
                  rows={breakdownRows(rows, labels as Record<string, string>)}
                  emptyMessage={copy.breakdowns.empty}
                />
              ))}
            </div>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <DataTable
                  caption={copy.rulesTable.caption}
                  emptyMessage={copy.rulesTable.empty}
                  rows={ruleRows ?? []}
                  getRowKey={(r) => r.id}
                  columns={[
                    { key: "rule", header: copy.rulesTable.columns.rule, className: "font-medium", cell: (r) => r.id },
                    { key: "settles", header: copy.rulesTable.columns.settles, cell: (r) => (r.settles ? copy.rulesTable.yes : copy.rulesTable.no) },
                    { key: "baseline", header: copy.rulesTable.columns.baseline, cell: (r) => r.baseline },
                    { key: "whatIf", header: copy.rulesTable.columns.whatIf, cell: (r) => (r.whatIf === null ? copy.dash : r.whatIf) },
                  ]}
                />
                <p className="text-sm">
                  {copy.settledLine(
                    copy.baselineLabel,
                    intervalText(report.rules.baseline.settledShare),
                    intervalText(report.rules.baseline.settledShareResolved),
                  )}
                </p>
                {report.rules.whatIf && (
                  <p className="text-sm">
                    {copy.settledLine(
                      copy.whatIfLabel,
                      intervalText(report.rules.whatIf.settledShare),
                      intervalText(report.rules.whatIf.settledShareResolved),
                    )}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {copy.agreement(
                    report.rules.baseline.agreement.agrees,
                    report.rules.baseline.agreement.falseApprovals,
                    report.rules.baseline.agreement.other,
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{copy.whatIf.title}</CardTitle>
                <CardDescription>{copy.whatIf.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={recalculate} className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="threshold-r08">{copy.whatIf.r08}</Label>
                    <Input
                      id="threshold-r08"
                      inputMode="decimal"
                      placeholder="150,00"
                      value={thresholds.R08}
                      onChange={(e) => setThresholds((t) => ({ ...t, R08: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="threshold-r09">{copy.whatIf.r09}</Label>
                    <Input
                      id="threshold-r09"
                      inputMode="decimal"
                      placeholder="60,00"
                      value={thresholds.R09}
                      onChange={(e) => setThresholds((t) => ({ ...t, R09: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {copy.whatIf.submit}
                  </Button>
                </form>
                {thresholdError && (
                  <div className="mt-3">
                    <ErrorMessage message={thresholdError} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{copy.cases.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  caption={copy.cases.caption}
                  emptyMessage={copy.cases.empty}
                  columns={caseColumns}
                  rows={report.cases}
                  getRowKey={(c) => c.id}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{copy.note.title}</CardTitle>
                <CardDescription>{copy.note.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => download(report.note)}>
                  {copy.note.download}
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyNote(report.note)}>
                  {copy.note.copy}
                </Button>
                {copyStatus && (
                  <span role="status" className="text-sm text-muted-foreground">
                    {copyStatus}
                  </span>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
