# CMP-001: customer files a complaint end to end (lookup -> complaint wizard -> RMA status page).
# Scenario: .ai/qa/CMP/CMP-001-customer-files-complaint.md
# Native PowerShell twin of CMP-001-customer-files-complaint.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
$QaId = 'CMP-001'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$OrderNumber = 'PL-10005'
$OrderEmail = 'maria.lewandowska@example.pl'
$ItemName = 'Czapka polarowa'
$Defect = 'Szew czapki rozpruł się po pierwszym praniu i materiał się strzępi.'
Initialize-Qa
try {
  Step 'open the lookup page and look up the order'
  Ab open "$BaseUrl/" | Out-Null
  WaitText 'Zwrot zamówienia'
  FillLabel 'Numer zamówienia' $OrderNumber
  FillLabel 'Adres e-mail' $OrderEmail
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitUrl '**/returns'
  WaitText 'Twoje zgłoszenia'

  Step 'start a complaint and pick the item'
  ClickRole 'link' 'Zgłoś reklamację produktu'
  WaitUrl '**/returns/complaint/new'
  WaitText 'Których produktów dotyczy reklamacja?'
  ClickRole 'checkbox' $ItemName
  ClickRole 'button' 'Dalej'
  WaitText 'Opisz wadę'
  Shot '01-defect-step'

  Step 'negative: a too short description does not leave the defect step'
  FillLabel 'Co jest nie tak z produktem?' 'Za krótko'
  FillDate (Get-Date -Format 'yyyy-MM-dd')
  ClickRole 'button' 'Dalej'
  WaitText 'Opisz wadę w co najmniej 20 znakach.'

  Step 'defect, return method, resolution'
  FillLabel 'Co jest nie tak z produktem?' $Defect
  ClickRole 'button' 'Dalej'
  WaitText 'Jak odeślesz produkt?'
  ClickRole 'radio' 'Kurier'
  ClickRole 'button' 'Dalej'
  WaitText 'Czego oczekujesz?'
  WaitText 'Zgodnie z prawem w pierwszej kolejności przysługuje Ci naprawa lub wymiana.'
  ClickRole 'radio' 'Naprawa'
  ClickRole 'button' 'Dalej'
  WaitText 'Sprawdź i wyślij reklamację'
  WaitText $ItemName
  Shot '02-summary'

  Step 'negative: submit without confirming stays on the summary'
  ClickRole 'button' 'Wyślij reklamację'
  WaitText 'Zaznacz potwierdzenie, aby wysłać reklamację.'

  Step 'confirm and submit'
  ClickRole 'checkbox' 'Potwierdzam'
  ClickRole 'button' 'Wyślij reklamację'
  WaitUrl '**/returns/RMA-*'
  $m = [regex]::Match((CurUrl), '/returns/(RMA-\d+-\d+)')
  if (-not $m.Success) { Fail 'no RMA number in the URL' }
  $script:Rma = $m.Groups[1].Value
  Write-Host "created $($script:Rma)"

  Step 'status page shows the complaint as submitted'
  WaitText 'Aktualny status: Zgłoszone'
  WaitText $ItemName
  Shot '03-status'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
