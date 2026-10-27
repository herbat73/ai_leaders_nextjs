# RET-008: the inbox filters by ?status=, an unknown filter falls back with a message, a non-numeric card id is a 404.
# Scenario: .ai/qa/RET/RET-008-inbox-filters-by-status.md
# Native PowerShell twin of RET-008-inbox-filters-by-status.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Setup: a return is created through the API on seeded order PL-10001 (line L2) and stays `submitted`; cleanup rejects it.
$QaId = 'RET-008'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'setup: customer submits a return through the API'
  GuestLookup 'PL-10001' 'anna.kowalska@example.pl'
  $r = GuestSubmit (ReturnJson 'L2')
  $m = [regex]::Match($r.Body, '"rma":"(RMA-\d+-\d+)"')
  if (-not $m.Success) { Fail "setup: return not created (unit held by an open request?): $($r.Body)" }
  $script:Rma = $m.Groups[1].Value
  Write-Host "created $($script:Rma)"

  Step 'the submitted filter lists the new return'
  AgentLoginUi
  Ab open "$BaseUrl/admin/returns?status=submitted" | Out-Null
  WaitText $script:Rma
  Shot '01-submitted'

  Step 'negative: the rejected filter does not list it'
  Ab open "$BaseUrl/admin/returns?status=rejected" | Out-Null
  WaitText 'Zwroty i reklamacje'
  ExpectNoText $script:Rma "$($script:Rma) listed under the rejected filter"

  Step 'negative: an unknown filter shows everything with a message'
  Ab open "$BaseUrl/admin/returns?status=nie-ma-takiego" | Out-Null
  WaitText 'Nieznany filtr, pokazuję wszystkie zgłoszenia.'
  WaitText $script:Rma

  Step 'negative: a non-numeric card id is not found'
  Ab open "$BaseUrl/admin/returns/abc" | Out-Null
  Ab wait --text '404' | Out-Null
  if ($LASTEXITCODE -ne 0) { Ab wait --text 'could not be found' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no not-found page for /admin/returns/abc' } }
  Shot '02-not-found'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
