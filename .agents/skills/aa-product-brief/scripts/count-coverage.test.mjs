// Unit tests for count-coverage.mjs. Run: node --test .agents/skills/aa-product-brief/scripts/count-coverage.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./count-coverage.mjs", import.meta.url));

function run(content, eol = "\n") {
  const dir = mkdtempSync(join(tmpdir(), "count-coverage-"));
  const file = join(dir, "brief.md");
  writeFileSync(file, content.join(eol));
  return spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
}

const BRIEF = [
  "# Brief",
  "- Header line before any section is ignored `[DOCUMENT]`",
  "## Decision summary",
  "- Excluded section `[DOCUMENT]`",
  "## Problems, with evidence",
  "- One tag `[DOCUMENT]`",
  "- First tag wins `[ASSUMPTION]` then `[DATA]`",
  "- Untagged line",
  "- Interview `[INTERVIEW]`",
  "## Goals and success criteria",
  "- Product `[PRODUCT]`",
  "- Benchmark `[BENCHMARK]`",
  "- Synthetic `[SYNTHETIC]`",
  "- Data `[DATA]`",
  "## Traceability (summary)",
  "- Excluded by prefix `[PRODUCT]`",
  "## Collection plan",
  "- Excluded `[DATA]`",
];

const EXPECTED =
  "Coverage: 7 claims — 5 sourced (interview 1, data 1, document 1, product 1, benchmark 1), 1 synthetic, 1 assumed";

test("counts the first tag per line and skips the header and excluded sections", () => {
  const result = run(BRIEF);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), EXPECTED);
});

test("handles CRLF line endings", () => {
  const result = run(BRIEF, "\r\n");
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), EXPECTED);
});

test("ignores tags that are not backticked", () => {
  const result = run(["## Problems", "- Plain [DOCUMENT] text"]);
  assert.equal(result.stdout.trim(), "Coverage: 0 claims — 0 sourced (interview 0, data 0, document 0, product 0, benchmark 0), 0 synthetic, 0 assumed");
});

test("exits 1 with usage when no file is given", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node count-coverage\.mjs <brief\.md>/);
});
