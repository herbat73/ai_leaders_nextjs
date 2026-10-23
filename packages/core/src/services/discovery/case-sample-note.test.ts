import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CaseSampleService } from "./case-sample.service";
import { renderCaseSampleNote, valueBand } from "./case-sample-note";

const fixture = readFileSync(new URL("./__fixtures__/case-sample.csv", import.meta.url), "utf8");
const service = new CaseSampleService();
const report = service.analyze({ csv: fixture });
const note = renderCaseSampleNote(report, new Date("2026-10-23T10:00:00Z"));

describe("renderCaseSampleNote", () => {
  it("carries the literal [DATA] tag, header and owner", () => {
    expect(note.split("\n")[0]).toBe("# Próba przypadków — follow-upy i pokrycie regułami [DATA]");
    expect(note).toContain("- Data: 2026-10-23");
    expect(note).toContain("lipiec 2026");
    expect(note).toContain("Właściciel: kierownik obsługi klienta");
  });

  it("shows intervals, the 35% threshold and the not-agreed kill line", () => {
    expect(note).toContain("75% (47%–91%)");
    expect(note).toContain("58% (32%–81%)");
    expect(note).toContain("próg hipotezy 35%");
    expect(note).toMatch(/linia odcięcia.*nieuzgodniona/);
    expect(note).toContain("zgodne 5, fałszywe akceptacje 1, inne 1");
  });

  it("states the sampling caveat and the pseudonymisation limit", () => {
    expect(note).toContain("Ta próba to najnowsze sprawy");
    expect(note).toContain("spseudonimizowane, nie anonimowe");
  });

  it("uses — for empty medians", () => {
    const empty = service.analyze({ csv: fixture.split("\n").slice(0, 1).concat('A1,mail,return,home,"10,00",2026-07-01,,0,1,open').join("\n") });
    expect(renderCaseSampleNote(empty)).toContain("Mediana dni do rozstrzygnięcia wg rodzaju: —");
  });

  it("shows no raw case_ref, exact amount or exact day", () => {
    expect(note).not.toMatch(/\bS\d\d\b/);
    for (const exact of ["89,00", "149,99", "150,01", "2500", "2026-07-0", "2026-07-1"]) expect(note).not.toContain(exact);
    expect(note).toContain("60–150 zł");
    expect(note).toContain("> 2000 zł");
  });

  it("adds the what-if section only when used", () => {
    expect(note).not.toContain("Scenariusz z innymi progami");
    const tuned = renderCaseSampleNote(service.analyze({ csv: fixture, thresholds: { R08: 20000 } }));
    expect(tuned).toContain("Scenariusz z innymi progami");
    expect(tuned).toContain("67% (39%–86%)");
  });
});

describe("valueBand", () => {
  it.each([
    [6000, "≤ 60 zł"],
    [6001, "60–150 zł"],
    [15000, "60–150 zł"],
    [15001, "150–500 zł"],
    [200000, "500–2000 zł"],
    [200001, "> 2000 zł"],
  ])("%i → %s", (minor, band) => expect(valueBand(minor)).toBe(band));
});
