# RET-007: an agent moves a return through approved, in transit and received to resolved; the customer sees each result.
# Scenario: .ai/qa/RET/RET-007-agent-takes-a-return-to-resolved.md
# Native PowerShell twin of RET-007-agent-takes-a-return-to-resolved.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# A resolved return keeps its unit, so cleanup releases it in the disposable test database (see common.ps1).
$QaId = 'RET-007'
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

  Step 'agent opens the card'
  AgentLoginUi
  OpenCard $script:Rma

  Step 'approve, in transit, received, resolved'
  ClickRole 'button' 'Zatwierdź'
  WaitText 'Zatwierdzone'
  ClickRole 'button' 'Oznacz jako w drodze'
  WaitText 'W drodze'
  ClickRole 'button' 'Oznacz jako odebrane'
  WaitText 'Odebrane'
  ClickRole 'button' 'Zakończ'
  WaitText 'Zakończone'
  Shot '01-resolved'

  Step 'the timeline records every move and the card offers no further action'
  foreach ($label in 'Zgłoszenie utworzone', 'Zatwierdzone', 'W drodze', 'Odebrane', 'Zakończone') { ExpectText $label "timeline entry `"$label`" missing" }
  WaitText 'Dla tego statusu nie ma dostępnych akcji.'

  Step 'the customer-facing view shows the return as resolved'
  ClickRole 'link' 'Podgląd widoku klienta'
  WaitText 'Aktualny status: Zakończone'
  Shot '02-customer-view'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
