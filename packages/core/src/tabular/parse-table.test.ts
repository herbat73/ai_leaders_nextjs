import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseTable } from "./parse-table";
import { looksLikePersonalData } from "./personal-data";

const schema = z.object({
  ref: z.string().min(1, "Wymagane"),
  value: z.string().regex(/^\d+$/, "Nieprawidłowa liczba"),
  note: z.string().optional(),
});

const ok = (text: string, options = { maxRows: 10 }) => parseTable(text, schema, options);

describe("parseTable", () => {
  it("parses commas and semicolons, a BOM, and normalizes headers", () => {
    for (const text of ["ref,value\nA,1\nB,2", "﻿ Ref ; VALUE \nA;1\nB;2"]) {
      const result = ok(text);
      expect(result).toMatchObject({ ok: true, droppedColumns: [] });
      expect(result.ok && result.rows.map((r) => r.value)).toEqual([
        { ref: "A", value: "1" },
        { ref: "B", value: "2" },
      ]);
    }
  });

  it("drops unknown columns and reports them by name", () => {
    const result = ok("ref,value,customer_name\nA,1,Jan");
    expect(result).toMatchObject({ ok: true, droppedColumns: ["customer_name"] });
    expect(result.ok && result.rows[0]?.value).toEqual({ ref: "A", value: "1" });
  });

  it("reports line numbers (header is line 1), skipping blank lines without shifting them", () => {
    const result = ok("ref,value\nA,1\n\nB,x");
    expect(result).toEqual({ ok: false, errors: [{ line: 4, column: "value", message: "Nieprawidłowa liczba" }] });
  });

  it("rejects missing and duplicate columns", () => {
    expect(ok("ref\nA")).toMatchObject({ ok: false, errors: [{ line: 1, column: "value", message: "Brak kolumny" }] });
    expect(ok("ref,ref,value\nA,A,1")).toMatchObject({ ok: false, errors: [{ line: 1 }] });
  });

  it("rejects the replacement character, an empty file, no data rows, too many rows and ragged rows", () => {
    expect(ok("ref,value\nA�,1")).toMatchObject({ ok: false, errors: [{ line: 0 }] });
    expect(ok("")).toMatchObject({ ok: false, errors: [{ line: 0 }] });
    expect(ok("ref,value\n")).toMatchObject({ ok: false, errors: [{ line: 0 }] });
    expect(ok("ref,value\nA,1\nB,2", { maxRows: 1 })).toMatchObject({ ok: false, errors: [{ line: 0 }] });
    expect(ok("ref,value\nA")).toMatchObject({ ok: false, errors: [{ line: 2 }] });
  });

  it("runs the cell guard over dropped columns and names only the row", () => {
    const result = parseTable("ref,value,mail\nA,1,jan@example.com", schema, {
      maxRows: 10,
      cellGuard: looksLikePersonalData,
    });
    expect(result).toMatchObject({ ok: false, errors: [{ line: 2 }] });
    expect(JSON.stringify(result)).not.toContain("jan@example.com");
  });

  it("guards header cells too and never echoes a duplicated header cell", () => {
    const noHeader = parseTable("jan@example.com,jan@example.com\n1,2", schema, { maxRows: 10, cellGuard: looksLikePersonalData });
    expect(noHeader).toMatchObject({ ok: false, errors: [{ line: 1 }] });
    expect(JSON.stringify(noHeader)).not.toContain("jan@example.com");
    expect(JSON.stringify(ok("secret,secret,ref,value\n1,2,A,1"))).not.toContain("secret");
  });

  it("never puts a cell value in an error message", () => {
    const result = ok("ref,value\nSECRET-REF,SECRET-VALUE");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

describe("looksLikePersonalData", () => {
  it.each(["jan@example.com", "600123456", "+48 600-123-456", "0048 600 123 456", "(600) 123.456", "600.123.456", "600,123,456", "48 600 123 456"])(
    "flags %j",
    (cell) => expect(looksLikePersonalData(cell)).toBe(true),
  );

  it.each(["1000000.00", "1000000,00", "149,99", "2026-07-01", "01.07.2026", "S01", "", "12"])("accepts %j", (cell) =>
    expect(looksLikePersonalData(cell)).toBe(false),
  );
});
