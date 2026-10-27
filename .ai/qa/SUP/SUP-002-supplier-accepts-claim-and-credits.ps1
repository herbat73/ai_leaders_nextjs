# SUP-002: an agent records that the supplier accepted a claim (with a credit amount) and later that the credit note booked.
# Scenario: .ai/qa/SUP/SUP-002-supplier-accepts-claim-and-credits.md
# Native PowerShell twin of SUP-002-supplier-accepts-claim-and-credits.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The claim is marked `sent` in the test database (see ClaimCreateSent in common.ps1).
$QaId = 'SUP-002'
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
  Shot '01-sent'

  Step 'negative: an accepted claim needs a positive credit amount'
  ClickRole 'button' 'Dostawca uznał reklamację'
  ClickRole 'button' 'Zapisz uznanie'
  WaitText 'Podaj kwotę większą od zera'

  Step 'negative: the credit cannot exceed the claimed products'
  FillLabel 'Kwota noty kredytowej (zł)' '49,01'
  ClickRole 'button' 'Zapisz uznanie'
  WaitText 'Kwota przekracza wartość reklamowanych produktów.'

  Step 'a valid amount records the acceptance'
  FillLabel 'Kwota noty kredytowej (zł)' '20,00'
  ClickRole 'button' 'Zapisz uznanie'
  WaitText 'Uznana, czeka na notę'
  WaitText '20,00'
  Shot '02-accepted'

  Step 'the credit note booking closes the claim'
  ClickRole 'button' 'Nota kredytowa zaksięgowana'
  WaitText 'Nota zaksięgowana'
  ExpectNoSnap 'button "Nota kredytowa zaksięgowana"' 'booking action still offered after crediting'
  Shot '03-credited'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
