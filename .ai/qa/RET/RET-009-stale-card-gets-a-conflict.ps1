# RET-009: a decision made on a stale card is refused with the current status, and the other agent's decision stands.
# Scenario: .ai/qa/RET/RET-009-stale-card-gets-a-conflict.md
# Native PowerShell twin of RET-009-stale-card-gets-a-conflict.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# An approved return cannot be rejected through the API, so cleanup releases its unit in the disposable test database.
$QaId = 'RET-009'
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

  Step 'agent A opens the card while it is submitted'
  AgentLoginUi
  OpenCard $script:Rma
  ExpectSnap 'button "Zatwierdź"' 'no approve button on a submitted return'

  Step 'agent B approves the return meanwhile (API)'
  AgentLoginApi
  $cid = (ReturnRow $script:Rma).id
  if ((AgentMove $cid 'approved' $null) -ne 200) { Fail 'the other agent could not approve' }

  Step 'negative: agent A approves from the stale card and gets a conflict with the current status'
  ClickRole 'button' 'Zatwierdź'
  WaitText 'Status zgłoszenia zmienił się w międzyczasie. Aktualny status: Zatwierdzone.'
  Shot '01-conflict'

  Step 'the other agent''s decision stands after a reload'
  Ab open "$BaseUrl/admin/returns/$cid" | Out-Null
  WaitText 'Zatwierdzone'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
