# RET-005: a wrong order number and a wrong e-mail give the same neutral message, and no session is created.
# Scenario: .ai/qa/RET/RET-005-lookup-answers-neutrally-for-wrong-data.md
# Native PowerShell twin of RET-005-lookup-answers-neutrally-for-wrong-data.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The lookup limiter counts failures per IP: this script makes 3 failed lookups. Creates nothing, so there is nothing to clean up.
$QaId = 'RET-005'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$Msg = 'Nie znaleźliśmy zamówienia pasującego do podanych danych.'
Initialize-Qa
try {
  Step 'negative: a wrong e-mail for an existing order'
  Ab open "$BaseUrl/" | Out-Null
  WaitText 'Zwrot zamówienia'
  FillLabel 'Numer zamówienia' 'PL-10001'
  FillLabel 'Adres e-mail' 'ktos.inny@example.pl'
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitText $Msg

  Step 'negative: an unknown order number gives the same message'
  FillLabel 'Numer zamówienia' 'PL-99999'
  FillLabel 'Adres e-mail' 'anna.kowalska@example.pl'
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitText $Msg
  $url = CurUrl
  if ($url -ne "$BaseUrl/" -and $url -ne $BaseUrl) { Fail "left the lookup page after a failed lookup: $url" }
  Shot '01-neutral-error'

  Step 'the API answers both failures with the same code and no session cookie'
  $web = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $a = Api 'POST' '/api/returns/lookup' '{"orderNumber":"PL-10001","email":"ktos.inny@example.pl"}' $web
  if ($web.Cookies.GetCookies([uri]$BaseUrl).Count -gt 0) { Fail 'a session cookie was issued for a failed lookup' }
  $b = Api 'POST' '/api/returns/lookup' '{"orderNumber":"PL-99999","email":"anna.kowalska@example.pl"}' $null
  if ($a.Status -ne $b.Status) { Fail "different status codes for wrong e-mail ($($a.Status)) and wrong number ($($b.Status))" }
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
