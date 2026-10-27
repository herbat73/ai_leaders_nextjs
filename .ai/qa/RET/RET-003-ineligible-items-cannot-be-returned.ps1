# RET-003: a non-returnable line is disabled with its reason, and an order that is not delivered offers no wizard.
# Scenario: .ai/qa/RET/RET-003-ineligible-items-cannot-be-returned.md
# Native PowerShell twin of RET-003-ineligible-items-cannot-be-returned.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Creates no return, so there is nothing to clean up.
$QaId = 'RET-003'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'look up PL-10002 and start a return'
  Ab open "$BaseUrl/" | Out-Null
  WaitText 'Zwrot zamówienia'
  FillLabel 'Numer zamówienia' 'PL-10002'
  FillLabel 'Adres e-mail' 'jan.nowak@example.pl'
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitUrl '**/returns'
  ClickRole 'link' 'Rozpocznij zwrot'
  WaitUrl '**/returns/new'
  WaitText 'Które produkty chcesz zwrócić?'

  Step 'the non-returnable line is disabled and says why'
  WaitText 'Tego produktu nie można zwrócić'
  if (-not ((Snap) -split "`n" | Where-Object { $_ -match 'checkbox "Bielizna' -and $_ -match 'disabled' })) { Fail 'the non-returnable line is selectable' }
  Shot '01-ineligible-line'

  Step 'the returnable line stays selectable'
  if (-not ((Snap) -split "`n" | Where-Object { $_ -match 'checkbox "Kubek' -and $_ -notmatch 'disabled' })) { Fail 'the returnable line is not selectable' }

  Step 'negative: continuing without any selection stays on the first step'
  ClickRole 'button' 'Dalej'
  WaitText 'Które produkty chcesz zwrócić?'

  Step 'an order that is not delivered offers no wizard but a tracking link'
  Ab open "$BaseUrl/returns" | Out-Null
  ClickRole 'button' 'Wyloguj'
  WaitUrl '**/'
  FillLabel 'Numer zamówienia' 'PL-10004'
  FillLabel 'Adres e-mail' 'piotr.zielinski@example.pl'
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitText 'To zamówienie nie zostało jeszcze dostarczone'
  WaitText 'Śledź przesyłkę'
  ExpectNoSnap 'link "Rozpocznij zwrot"' 'return wizard offered for an undelivered order'
  Shot '02-not-delivered'
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
