# RET-006: a customer chooses "Wymiana": the exchange note is required, no amount is quoted, the status page shows the return.
# Scenario: .ai/qa/RET/RET-006-customer-requests-an-exchange.md
# Native PowerShell twin of RET-006-customer-requests-an-exchange.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Order data: seeded PL-10001 / anna.kowalska@example.pl, line "Skarpety"; cleanup rejects the created return.
$QaId = 'RET-006'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'look up the order and start a return with one item'
  Ab open "$BaseUrl/" | Out-Null
  WaitText 'Zwrot zamówienia'
  FillLabel 'Numer zamówienia' 'PL-10001'
  FillLabel 'Adres e-mail' 'anna.kowalska@example.pl'
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitUrl '**/returns'
  ClickRole 'link' 'Rozpocznij zwrot'
  WaitUrl '**/returns/new'
  WaitText 'Które produkty chcesz zwrócić?'
  ClickRole 'checkbox' 'Skarpety'
  ClickRole 'button' 'Dalej'
  WaitText 'Dlaczego zwracasz'
  ClickRole 'radio' 'Nieodpowiedni rozmiar'
  ClickRole 'button' 'Dalej'
  WaitText 'Jak odeślesz paczkę?'
  ClickRole 'radio' 'Zwrot w sklepie'
  ClickRole 'button' 'Dalej'
  WaitText 'Co chcesz otrzymać?'

  Step 'choose the exchange: no amount is quoted'
  ClickRole 'radio' 'Wymiana'
  WaitText 'Na co chcesz wymienić?'
  ExpectNoText 'Szacowana kwota zwrotu' 'a refund quote is shown for an exchange'

  Step 'negative: continuing without the exchange note is refused'
  ClickRole 'button' 'Dalej'
  WaitText 'Opisz, na co chcesz wymienić produkt.'

  Step 'describe the exchange and continue to the summary'
  FillLabel 'Na co chcesz wymienić?' 'Skarpety wełniane w rozmiarze L'
  ClickRole 'button' 'Dalej'
  WaitText 'Sprawdź i wyślij zgłoszenie'
  WaitText 'Skarpety wełniane w rozmiarze L'
  Shot '01-summary'

  Step 'confirm and submit'
  ClickRole 'checkbox' 'Potwierdzam'
  ClickRole 'button' 'Wyślij zgłoszenie'
  WaitUrl '**/returns/RMA-*'
  $m = [regex]::Match((CurUrl), '/returns/(RMA-\d+-\d+)')
  if (-not $m.Success) { Fail 'no RMA number in the URL' }
  $script:Rma = $m.Groups[1].Value
  Write-Host "created $($script:Rma)"
  WaitText 'Aktualny status: Zgłoszone'
  WaitText 'Skarpety'
  Shot '02-status'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
