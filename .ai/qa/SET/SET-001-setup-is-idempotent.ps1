# SET-001: `npm run setup` can be re-run safely: it exits 0, reports each step as done or skipped, and points at `npm run dev`.
# Scenario: .ai/qa/SET/SET-001-setup-is-idempotent.md
# Native PowerShell twin of SET-001-setup-is-idempotent.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Type: CLI (no browser, no test environment). Runs the installer twice and compares: the second run must skip every step
# except the preflight. The negative paths (missing PostgreSQL binaries, port taken) are not simulated here.
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $Root
function Fail($m) { throw "FAIL: $m" }
function Run-Setup { $out = (npm run setup 2>&1 | Out-String); @{ Code = $LASTEXITCODE; Out = $out } }

Write-Host '-- first run'
$first = Run-Setup
if ($first.Code -ne 0) { Fail "npm run setup exited non-zero: $($first.Out)" }
if ($first.Out -notmatch '(?m)^Next: npm run dev') { Fail 'no "Next: npm run dev" line after the first run' }
if ($first.Out.Contains([string][char]0x2716)) { Fail "a step failed in the first run: $($first.Out)" }

Write-Host '-- second run'
$second = Run-Setup
if ($second.Code -ne 0) { Fail "the second run exited non-zero: $($second.Out)" }
if ($second.Out.Contains([string][char]0x2716)) { Fail "a step failed in the second run: $($second.Out)" }
if ($second.Out -notmatch '(?m)^Next: npm run dev') { Fail 'no "Next: npm run dev" line after the second run' }

Write-Host '-- negative: the second run must not redo any step'
foreach ($step in 'install dependencies', 'start database', 'run migrations') {
  if ($second.Out -notmatch "(?m)^$([char]0x21B7) $step $([char]0x2014) skipped") { Fail "step `"$step`" was not skipped on the second run: $($second.Out)" }
}
Write-Host 'PASS: SET-001'
