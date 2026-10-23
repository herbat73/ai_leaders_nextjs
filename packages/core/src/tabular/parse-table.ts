import Papa from "papaparse";
import { safeParse, type ZodObject, type ZodRawShape } from "zod";

export interface TableError {
  /** Line in the file (the header is line 1); 0 for a problem with the file as a whole. */
  line: number;
  column?: string;
  /** Never contains a cell value. */
  message: string;
}

export type ParsedTable<T> =
  | { ok: true; rows: { line: number; value: T }[]; droppedColumns: string[] }
  | { ok: false; errors: TableError[] };

export interface ParseTableOptions {
  maxRows: number;
  /** Runs over every raw cell, including columns that are dropped, before they are discarded. */
  cellGuard?: (cell: string) => boolean;
}

const BOM = /^﻿/;

/**
 * Parses delimited text (`,` or `;`, optional BOM) against a Zod object whose keys are the column whitelist.
 * Header names are trimmed and lower-cased; unknown columns are dropped and reported by name. All-or-nothing:
 * any problem returns errors keyed by line and no rows.
 */
export function parseTable<S extends ZodRawShape>(
  text: string,
  rowSchema: ZodObject<S>,
  options: ParseTableOptions,
): ParsedTable<ReturnType<ZodObject<S>["parse"]>> {
  if (text.includes("�")) {
    return fail({ line: 0, message: "Plik nie jest zapisany jako UTF-8" });
  }
  const parsed = Papa.parse<string[]>(text.replace(BOM, ""), {
    delimitersToGuess: [",", ";"],
    skipEmptyLines: false,
  });
  const records = parsed.data;
  const header = records[0]?.map((name) => name.trim().toLowerCase());
  if (!header || header.every((name) => name === "")) return fail({ line: 0, message: "Plik jest pusty" });

  if (options.cellGuard && records[0]?.some((cell) => options.cellGuard?.(cell))) {
    return fail({
      line: 1,
      message: "Nagłówek wygląda na dane osobowe (brak wiersza nagłówka?) — dodaj nagłówek i wczytaj plik ponownie",
    });
  }

  const known = Object.keys(rowSchema.shape);
  const errors: TableError[] = [];
  const seen = new Set<string>();
  for (const name of header) {
    if (seen.has(name)) errors.push({ line: 1, message: "Powtórzona kolumna w nagłówku" });
    seen.add(name);
  }
  for (const key of known) {
    const field = rowSchema.shape[key];
    const optional = field !== undefined && safeParse(field, undefined).success;
    if (!seen.has(key) && !optional) errors.push({ line: 1, column: key, message: "Brak kolumny" });
  }
  if (errors.length > 0) return { ok: false, errors };

  const droppedColumns = header.filter((name) => name !== "" && !known.includes(name));
  const dataRows = records
    .map((cells, index) => ({ cells, line: index + 1 }))
    .slice(1)
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ""));

  if (dataRows.length === 0) return fail({ line: 0, message: "Plik nie zawiera wierszy z danymi" });
  if (dataRows.length > options.maxRows) {
    return fail({ line: 0, message: `Zbyt wiele wierszy (limit ${options.maxRows})` });
  }

  if (options.cellGuard) {
    const guarded = dataRows.filter(({ cells }) => cells.some((cell) => options.cellGuard?.(cell)));
    if (guarded.length > 0) {
      return {
        ok: false,
        errors: guarded.map(({ line }) => ({
          line,
          message: "Wiersz wygląda na dane osobowe — usuń tę kolumnę z pliku i wczytaj go ponownie",
        })),
      };
    }
  }

  const rows: { line: number; value: ReturnType<ZodObject<S>["parse"]> }[] = [];
  for (const { cells, line } of dataRows) {
    if (cells.length !== header.length) {
      errors.push({ line, message: "Nieprawidłowa liczba kolumn w wierszu" });
      continue;
    }
    const raw: Record<string, string> = {};
    header.forEach((name, i) => {
      if (known.includes(name)) raw[name] = (cells[i] ?? "").trim();
    });
    const result = rowSchema.safeParse(raw);
    if (result.success) rows.push({ line, value: result.data });
    else {
      for (const issue of result.error.issues) {
        errors.push({ line, column: issue.path.map(String).join(".") || undefined, message: issue.message });
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows, droppedColumns };
}

function fail(error: TableError): { ok: false; errors: TableError[] } {
  return { ok: false, errors: [error] };
}
