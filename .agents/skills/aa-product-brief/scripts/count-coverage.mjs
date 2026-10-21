#!/usr/bin/env node
// Counts evidence-tagged claim lines in a product brief, using the om-discover Coverage rules:
// each tagged body line counts once (first tag on the line), excluding non-counted sections.
// Usage: node count-coverage.mjs <brief.md>
import { readFileSync } from "node:fs";

const EXCLUDED = [
  "Decision summary",
  "Hypotheses to test",
  "Concept surface",
  "Traceability",
  "Collection plan",
  "Definition of Ready",
];
const TAG = /`\[(INTERVIEW|DATA|DOCUMENT|PRODUCT|BENCHMARK|SYNTHETIC|ASSUMPTION)\]`/;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node count-coverage.mjs <brief.md>");
  process.exit(1);
}

const counts = { INTERVIEW: 0, DATA: 0, DOCUMENT: 0, PRODUCT: 0, BENCHMARK: 0, SYNTHETIC: 0, ASSUMPTION: 0 };
let section = null; // null = header, before the first "## " heading
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  if (line.startsWith("## ")) section = line.slice(3);
  if (section === null || EXCLUDED.some((name) => section.startsWith(name))) continue;
  const match = TAG.exec(line);
  if (match) counts[match[1]] += 1;
}

const sourced = counts.INTERVIEW + counts.DATA + counts.DOCUMENT + counts.PRODUCT + counts.BENCHMARK;
const claims = sourced + counts.SYNTHETIC + counts.ASSUMPTION;
console.log(
  `Coverage: ${claims} claims — ${sourced} sourced (interview ${counts.INTERVIEW}, data ${counts.DATA}, ` +
    `document ${counts.DOCUMENT}, product ${counts.PRODUCT}, benchmark ${counts.BENCHMARK}), ` +
    `${counts.SYNTHETIC} synthetic, ${counts.ASSUMPTION} assumed`,
);
