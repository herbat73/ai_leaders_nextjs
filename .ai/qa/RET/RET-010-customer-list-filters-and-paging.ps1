# RET-010: the customer list pages by ten, filters by status, RMA fragment and submission day, and clears back to the full list.
# Scenario: .ai/qa/RET/RET-010-customer-list-filters-and-paging.md
# Native PowerShell twin of RET-010-customer-list-filters-and-paging.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Setup: a return is created through the API on seeded order PL-10001 (line L2) and stays `submitted`; cleanup rejects it.
$QaId = 'RET-010'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
function Rows { [int](Ab eval "document.querySelectorAll('section[aria-label=\"Zgłoszenia zwrotu i reklamacji\"] ul li').length" | Select-Object -Last 1) }
try {
  Step 'setup: customer submits a return through the API'
  GuestLookup 'PL-10001' 'anna.kowalska@example.pl'
  $r = GuestSubmit (ReturnJson 'L2')
  $m = [regex]::Match($r.Body, '"rma":"(RMA-\d+-\d+)"')
  if (-not $m.Success) { Fail "setup: return not created (unit held by an open request?): $($r.Body)" }
  $script:Rma = $m.Groups[1].Value
  $rma = $script:Rma
  Write-Host "created $rma"
  $today = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Central European Standard Time').ToString('yyyy-MM-dd')

  Step 'the list shows ten rows, the newest first, and a pager'
  # The server-rendered lookup page shows its text before hydration; a fill made too early is wiped, so retry the whole attempt.
  $reached = $false
  foreach ($attempt in 1..3) {
    Ab open "$BaseUrl/" | Out-Null
    WaitText 'Zwrot zamówienia'
    Start-Sleep -Seconds 2
    Ab find label 'Numer zamówienia' fill 'PL-10001' | Out-Null; if ($LASTEXITCODE -ne 0) { continue }
    Ab find label 'Adres e-mail' fill 'anna.kowalska@example.pl' | Out-Null; if ($LASTEXITCODE -ne 0) { continue }
    Ab find role button click --name 'Sprawdź zamówienie' | Out-Null; if ($LASTEXITCODE -ne 0) { continue }
    Ab wait --url '**/returns' | Out-Null; if ($LASTEXITCODE -eq 0) { $reached = $true; break }
  }
  if (-not $reached) { Fail 'customer lookup did not reach /returns' }
  WaitText 'Strona 1 z'
  if ((Rows) -ne 10) { Fail "expected 10 rows on page 1, got $(Rows)" }
  ExpectText $rma "$rma missing from page 1"
  Shot '01-page-1'

  Step 'Następna keeps the filters and moves to page 2'
  ClickRole 'link' 'Następna'
  WaitText 'Strona 2 z'
  if ((CurUrl) -notmatch 'page=2') { Fail "page 2 not in the URL: $(CurUrl)" }
  ExpectNoText $rma "$rma still listed on page 2"
  Shot '02-page-2'

  Step 'search by an RMA fragment through the form'
  Ab open "$BaseUrl/returns" | Out-Null
  WaitText 'Strona 1 z'
  FillLabel 'Numer RMA' $rma.ToLower()
  ClickRole 'button' 'Szukaj'
  WaitUrl '**q=*'
  WaitText $rma
  if ((Rows) -ne 1) { Fail "expected 1 row for the RMA search, got $(Rows)" }
  ExpectNoText 'Strona 1 z' 'pager shown for a single page'
  Shot '03-search'

  Step 'status filter: submitted lists it, resolved with the same RMA lists nothing'
  Ab open "$BaseUrl/returns?status=submitted&q=$rma" | Out-Null
  WaitText $rma
  Ab open "$BaseUrl/returns?status=resolved&q=$rma" | Out-Null
  WaitText 'Brak zgłoszeń dla wybranych filtrów'
  ExpectNoText 'Nie masz jeszcze zgłoszeń' 'the empty-order message shown for a filter with no match'

  Step 'date range: today lists it, a past range and a reversed range list nothing'
  Ab open "$BaseUrl/returns?from=$today&to=$today&q=$rma" | Out-Null
  WaitText $rma
  Ab open "$BaseUrl/returns?from=2000-01-01&to=2000-01-02&q=$rma" | Out-Null
  WaitText 'Brak zgłoszeń dla wybranych filtrów'
  Ab open "$BaseUrl/returns?from=2030-01-01&to=2020-01-01&q=$rma" | Out-Null
  WaitText 'Brak zgłoszeń dla wybranych filtrów'
  Shot '04-no-match'

  Step 'Wyczyść returns to the full list'
  ClickRole 'link' 'Wyczyść'
  WaitText 'Strona 1 z'
  if ((CurUrl) -notmatch '/returns$') { Fail "clear did not reach /returns: $(CurUrl)" }
  if ((Rows) -ne 10) { Fail "expected 10 rows after clearing, got $(Rows)" }

  Step 'negative: invalid status, date and page in the URL are ignored'
  Ab open "$BaseUrl/returns?status=nie-ma&from=xx&page=abc" | Out-Null
  WaitText 'Strona 1 z'
  if ((Rows) -ne 10) { Fail "bad query values changed the list ($(Rows) rows)" }
  Write-Host "PASS: $QaId ($rma)"
} finally { Invoke-QaCleanup }
