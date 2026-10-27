# AGT-005: an agent opens the read-only customer-view preview of a return: banner, customer-facing status, no actions.
# Scenario: .ai/qa/AGT/AGT-005-agent-previews-customer-view.md
# Native PowerShell twin of AGT-005-agent-previews-customer-view.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Setup: a return is created through the API on seeded order PL-10001 (line L2); cleanup rejects it.
$QaId = 'AGT-005'
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

  Step 'agent opens the card and then the customer-view preview'
  AgentLoginUi
  OpenCard $script:Rma
  ClickRole 'link' 'Podgląd widoku klienta'
  WaitUrl '**/customer-view'
  WaitText 'Podgląd widoku klienta — tylko do odczytu'
  WaitText $script:Rma
  WaitText 'Aktualny status: Zgłoszone'
  Shot '01-preview'

  Step 'negative: the preview offers no decision actions'
  ExpectNoSnap 'button "Zatwierdź"' 'approve action shown in the read-only preview'
  ExpectNoSnap 'button "Odrzuć"' 'reject action shown in the read-only preview'

  Step 'the preview links back to the card'
  ClickRole 'link' '← Wróć do karty zwrotu'
  WaitText 'Decyzja'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
