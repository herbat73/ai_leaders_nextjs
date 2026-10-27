# SUP-003: an agent records that the supplier rejected a claim; the rejection needs a reason of enough characters.
# Scenario: .ai/qa/SUP/SUP-003-supplier-rejects-claim.md
# Native PowerShell twin of SUP-003-supplier-rejects-claim.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The claim is marked `sent` in the test database (see ClaimCreateSent in common.ps1).
$QaId = 'SUP-003'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$script:CleanupExtra = { CleanupSupplier }
Initialize-Qa
try {
  Step 'setup: supplier, received complaint with a confirmed defect, sent claim'
  AgentLoginApi
  SupplierCreate
  ComplaintCreate 'PL-10005' 'maria.lewandowska@example.pl' 'L2'
  ComplaintToReceived $true
  ClaimCreateSent

  Step 'agent opens the claim page'
  AgentLoginUi
  Ab open "$BaseUrl/admin/supplier-claims/$($script:ClaimId)" | Out-Null
  WaitText 'Wysłano, czekamy na dostawcę'

  Step 'negative: a rejection with a too short reason is refused'
  ClickRole 'button' 'Dostawca odrzucił reklamację'
  FillLabel 'Uzasadnienie dostawcy' 'Za krótko'
  ClickRole 'button' 'Zapisz odrzucenie'
  WaitText 'Podaj uzasadnienie (co najmniej'
  ExpectText 'Wysłano, czekamy na dostawcę' 'claim status changed despite the short reason'

  Step 'a long enough reason records the rejection'
  FillLabel 'Uzasadnienie dostawcy' 'Dostawca twierdzi, że uszkodzenie powstało z winy użytkownika.'
  ClickRole 'button' 'Zapisz odrzucenie'
  WaitText 'Odrzucona przez dostawcę'
  WaitText 'Dostawca twierdzi, że uszkodzenie powstało z winy użytkownika.'
  ExpectNoSnap 'button "Nota kredytowa zaksięgowana"' 'credit action offered for a rejected claim'
  Shot '01-rejected'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
