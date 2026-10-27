# SUP-001: with a non-delivering mail transport (the default `log`) a supplier claim is saved as a draft, never as sent.
# Scenario: .ai/qa/SUP/SUP-001-claim-stays-draft-without-delivering-mail.md
# Native PowerShell twin of SUP-001-claim-stays-draft-without-delivering-mail.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Requires the test env to run with the default log mail transport.
$QaId = 'SUP-001'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$script:CleanupExtra = { CleanupSupplier }
Initialize-Qa
try {
  Step 'setup: supplier and a received complaint with a confirmed defect (API)'
  AgentLoginApi
  SupplierCreate
  ComplaintCreate 'PL-10005' 'maria.lewandowska@example.pl' 'L2'
  ComplaintToReceived $true

  Step 'agent opens the card and sees the supplier section'
  AgentLoginUi
  OpenCard $script:Rma
  WaitText 'Reklamacja do dostawcy'
  Shot '01-section'

  Step 'negative: sending without choosing a supplier is refused'
  ClickRole 'button' 'Wyślij reklamację do dostawcy'
  WaitText 'Wybierz dostawcę.'

  Step 'choose the supplier; the card warns that mail is not delivered'
  ClickRole 'combobox' 'Dostawca'
  ClickRole 'option' $script:SupplierName
  WaitListboxClosed
  WaitText 'Poczta nie dostarcza wiadomości: reklamacja zostanie zapisana jako szkic.'
  WaitText 'Wymagane wideo wady.'

  Step 'send: the claim is saved as a draft, not as sent'
  ClickRole 'button' 'Wyślij reklamację do dostawcy'
  WaitText 'Szkic, nie wysłano'
  WaitText 'Otwórz reklamację'
  Shot '02-draft'

  Step 'the claim page shows it was not sent and a retry is refused'
  ClickRole 'link' 'Otwórz reklamację'
  WaitText 'Szkic, nie wysłano'
  WaitText 'Wiadomość nie została wysłana do dostawcy.'
  ClickRole 'button' 'Wyślij ponownie'
  WaitText 'Poczta nie jest skonfigurowana do wysyłki'
  ExpectNoText 'Wysłano, czekamy na dostawcę' 'claim marked sent without a delivering transport'
  Shot '03-claim-draft'

  Step 'the supplier claim list shows it as a draft'
  Ab open "$BaseUrl/admin/supplier-claims" | Out-Null
  WaitText 'Szkic, nie wysłano'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
