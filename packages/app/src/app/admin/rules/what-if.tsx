"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import type { RulesSimulation } from "@easyrms/core";
import {
  apiCall,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Input,
  Label,
  LoadingMessage,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@easyrms/ui/admin";

import { rulesCopy } from "./copy";

const copy = rulesCopy.whatIf;

export interface TunableRule {
  id: string;
  name: string;
  thresholdMinor: number;
}

const zloty = (minor: number): string => (minor / 100).toFixed(2).replace(".", ",");

/** Read-only what-if: the typed thresholds go to the server for one call and are never saved. */
export function WhatIf({ tunable }: { tunable: TunableRule[] }): ReactElement {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(tunable.map((rule) => [rule.id, ""])));
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState<RulesSimulation>();
  const [error, setError] = useState<string>();

  async function run(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const thresholds = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
    const result = await apiCall<{ simulation: RulesSimulation }>("/api/rules/simulate", { method: "POST", body: { thresholds } });
    setLoading(false);
    if (result.ok) {
      setSimulation(result.data.simulation);
      return;
    }
    setSimulation(undefined);
    setError(copy.errors[result.error.code] ?? copy.errors.fallback);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(event) => void run(event)} className="flex flex-wrap items-end gap-4">
          {tunable.map((rule) => (
            <div key={rule.id} className="space-y-1">
              <Label htmlFor={`threshold-${rule.id}`}>{copy.thresholdLabel(rule.id)}</Label>
              <Input
                id={`threshold-${rule.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={values[rule.id] ?? ""}
                placeholder={copy.placeholder(zloty(rule.thresholdMinor))}
                onChange={(event) => setValues((current) => ({ ...current, [rule.id]: event.target.value }))}
              />
            </div>
          ))}
          <Button type="submit" disabled={loading}>
            {loading ? copy.running : copy.run}
          </Button>
        </form>
        {loading && <LoadingMessage message={copy.running} />}
        {error && <ErrorMessage message={error} />}
        <p role="status" className="sr-only">
          {simulation ? copy.ready : ""}
        </p>
        {simulation && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{copy.summary(simulation.total, simulation.skipped)}</p>
            {simulation.truncated && <p className="text-sm text-muted-foreground">{copy.truncated}</p>}
            {simulation.total === 0 ? (
              <p className="text-sm">{copy.empty}</p>
            ) : (
              <Table>
                <TableCaption>{copy.caption}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.columns.rule}</TableHead>
                    <TableHead>{copy.columns.now}</TableHead>
                    <TableHead>{copy.columns.tried}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulation.definitions.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.id}</TableCell>
                      <TableCell>{simulation.baseline.matchedByRule[rule.id] ?? 0}</TableCell>
                      <TableCell>{simulation.whatIf.matchedByRule[rule.id] ?? 0}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">{copy.settledRow}</TableCell>
                    <TableCell>{copy.shareOf(simulation.baseline.settled, simulation.baseline.settledShare)}</TableCell>
                    <TableCell>{copy.shareOf(simulation.whatIf.settled, simulation.whatIf.settledShare)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
