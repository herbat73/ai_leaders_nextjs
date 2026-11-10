# SUP-004: the supplier list pages by ten, filters by status, name and e-mail (all must match), and clears the text fields.
# Scenario: .ai/qa/SUP/SUP-004-supplier-list-filters.md
# Native PowerShell twin of SUP-004-supplier-list-filters.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
$QaId = 'SUP-004'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$script:SupplierIds = @()
$script:CleanupExtra = {
  AgentLoginApi
  foreach ($id in $script:SupplierIds) {
    $r = AgentApi 'PATCH' "/api/suppliers/$id" '{"active":false}'
    if ($r.Status -ne 200) { Write-Host "cleanup FAILED ($($r.Status)): deactivate supplier $id by hand" -ForegroundColor Red }
  }
  Write-Host 'cleanup: suppliers deactivated'
}
Initialize-Qa
function Rows { [int]((Ab eval "document.querySelectorAll('table tbody tr').length" | Select-Object -Last 1)) }
function Enc($s) { [uri]::EscapeDataString($s) }
try {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $prefix = "QA SUP-004 $ts"

  Step 'setup: twelve suppliers, the last two inactive'
  AgentLoginApi
  foreach ($n in 1..12) {
    $nn = '{0:d2}' -f $n
    $r = AgentApi 'POST' '/api/suppliers' (@{ name = "$prefix $nn"; email = "qa004-$ts-$nn@qa-dostawca.example.pl"; guidelines = $null } | ConvertTo-Json)
    $id = $r.Json.data.supplier.id
    if (-not $id) { Fail "setup: supplier $nn not created: $($r.Body)" }
    $script:SupplierIds += $id
    if ($n -gt 10) { if ((AgentApi 'PATCH' "/api/suppliers/$id" '{"active":false}').Status -ne 200) { Fail "setup: could not deactivate supplier $nn" } }
  }

  Step 'name search through the form: ten rows and a pager'
  AgentLoginUi
  Ab open "$BaseUrl/admin/suppliers" | Out-Null
  WaitText 'Dostawcy, do których wysyłamy reklamacje'
  FillLabel 'Nazwa' $prefix
  ClickRole 'button' 'Szukaj'
  WaitUrl '**name=*'
  WaitText 'Strona 1 z 2'
  if ((Rows) -ne 10) { Fail "expected 10 rows on page 1, got $(Rows)" }
  Shot '01-page-1'

  Step 'Następna moves to page 2 and keeps the filter'
  ClickRole 'link' 'Następna'
  WaitText 'Strona 2 z 2'
  $url = CurUrl
  if ($url -notmatch 'page=2' -or $url -notmatch 'name=') { Fail "page 2 or the name filter missing from the URL: $url" }
  if ((Rows) -ne 2) { Fail "expected 2 rows on page 2, got $(Rows)" }
  Shot '02-page-2'

  Step 'status filter: inactive lists two, active lists ten without a pager'
  Ab open "$BaseUrl/admin/suppliers?status=inactive&name=$(Enc $prefix)" | Out-Null
  WaitText 'Nieaktywny'
  if ((Rows) -ne 2) { Fail "expected 2 inactive rows, got $(Rows)" }
  Ab open "$BaseUrl/admin/suppliers?status=active&name=$(Enc $prefix)" | Out-Null
  WaitText 'Aktywny'
  if ((Rows) -ne 10) { Fail "expected 10 active rows, got $(Rows)" }
  ExpectNoText 'Strona 1 z' 'pager shown for a single page'

  Step 'e-mail search through the form: one row'
  Ab open "$BaseUrl/admin/suppliers" | Out-Null
  WaitText 'Dostawcy, do których wysyłamy reklamacje'
  FillLabel 'E-mail' "QA004-$ts-07"
  ClickRole 'button' 'Szukaj'
  WaitUrl '**email=*'
  WaitText "$prefix 07"
  if ((Rows) -ne 1) { Fail "expected 1 row for the e-mail search, got $(Rows)" }
  Shot '03-email'

  Step 'negative: name and e-mail that do not belong to one supplier list nothing'
  Ab open "$BaseUrl/admin/suppliers?name=$(Enc "$prefix 01")&email=qa004-$ts-02" | Out-Null
  WaitText 'Brak dostawców dla wybranych filtrów'
  Shot '04-no-match'

  Step 'Wyczyść clears the text fields'
  ClickRole 'button' 'Wyczyść'
  # The click navigates on the client, so wait for the URL to lose the filters instead of reading it at once.
  foreach ($i in 1..20) { if ((CurUrl) -notmatch 'name=|email=') { break }; Start-Sleep -Milliseconds 500 }
  if ((CurUrl) -match 'name=|email=') { Fail "filters still in the URL: $(CurUrl)" }
  WaitText 'Dostawcy, do których wysyłamy reklamacje'
  if (-not (EvalBool "document.getElementById('supplier-filter-name').value + document.getElementById('supplier-filter-email').value === ''")) { Fail 'text fields not emptied' }

  Step 'negative: invalid status and page in the URL are ignored'
  Ab open "$BaseUrl/admin/suppliers?status=nie-ma&page=abc" | Out-Null
  WaitText 'Dostawcy, do których wysyłamy reklamacje'
  ExpectNoText 'Brak dostawców dla wybranych filtrów' 'bad status narrowed the list'

  Step 'deactivating the only row under the Aktywni filter makes it disappear'
  Ab open "$BaseUrl/admin/suppliers?status=active&email=qa004-$ts-01" | Out-Null
  WaitText "$prefix 01"
  if ((Rows) -ne 1) { Fail "expected 1 row before the toggle, got $(Rows)" }
  ClickRole 'button' 'Wyłącz'
  WaitText 'Brak dostawców dla wybranych filtrów'
  Shot '05-row-gone'
  Write-Host "PASS: $QaId ($prefix)"
} finally { Invoke-QaCleanup }
