# SUP-005: the supplier claims list pages by ten, filters by status, claim number or RMA, supplier name and creation day (all must match), and clears the text and date fields.
# Scenario: .ai/qa/SUP/SUP-005-supplier-claims-list-filters.md
# Native PowerShell twin of SUP-005-supplier-claims-list-filters.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
$QaId = 'SUP-005'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$script:SupplierBId = $null
$script:CleanupExtra = {
  CleanupSupplier
  if ($script:SupplierBId) {
    $r = AgentApi 'PATCH' "/api/suppliers/$($script:SupplierBId)" '{"active":false}'
    if ($r.Status -ne 200) { Write-Host "cleanup FAILED ($($r.Status)): deactivate supplier $($script:SupplierBId) by hand" -ForegroundColor Red }
  }
}
Initialize-Qa
function Rows { [int]((Ab eval "document.querySelectorAll('table tbody tr').length" | Select-Object -Last 1)) }
function Enc($s) { [uri]::EscapeDataString($s) }
function OpenList($query) { Ab open "$BaseUrl/admin/supplier-claims?$query" | Out-Null; WaitText 'Reklamacje do dostawców' }
function WarsawDay($days) { (DbSql "SELECT to_char((now() - interval '$days days') AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD')" | Select-Object -First 1).Trim() }
try {
  Step 'setup: two suppliers, one real sent claim'
  AgentLoginApi
  SupplierCreate
  $nameA = $script:SupplierName
  $nameB = "$nameA B"
  $r = AgentApi 'POST' '/api/suppliers' (@{ name = $nameB; email = 'b@qa-dostawca.example.pl'; guidelines = $null } | ConvertTo-Json)
  $script:SupplierBId = $r.Json.data.supplier.id
  if (-not $script:SupplierBId) { Fail "setup: supplier B not created: $($r.Body)" }
  ComplaintCreate 'PL-10005' 'maria.lewandowska@example.pl' 'L2'
  ComplaintToReceived $true
  ClaimCreateSent
  $realRma = $script:Rma

  Step 'setup: eleven claims on rejected history returns, one per past day'
  GuestLookup 'PL-10001' 'anna.kowalska@example.pl'
  $agentId = (DbSql 'SELECT min(id) FROM agents' | Select-Object -First 1).Trim()
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  foreach ($n in 1..11) {
    $old = GuestSubmit (ReturnJson 'L2')
    $m = [regex]::Match($old.Body, '"rma":"(RMA-\d+-\d+)"')
    if (-not $m.Success) { Fail "setup: history return $n not created: $($old.Body)" }
    $oldId = (ReturnRow $m.Groups[1].Value).id
    $rej = AgentApi 'PATCH' "/api/returns/$oldId" '{"status":"rejected","decisionNote":"SUP-005 setup: history return, unit released."}'
    if ($rej.Status -ne 200) { Fail "setup: could not reject $($m.Groups[1].Value)" }
    $nn = '{0:d2}' -f $n
    $sid = if ($n % 2 -eq 0) { $script:SupplierBId } else { $script:SupplierId }
    $st = if ($n -gt 9) { 'draft' } else { 'sent' }
    DbSql "INSERT INTO supplier_claims (ref, return_request_id, supplier_id, status, subject, body, created_by_agent_id, created_at, updated_at) VALUES ('SC-QA-$ts-$nn', $oldId, $sid, '$st', 'SUP-005', 'SUP-005', $agentId, now() - interval '$n days', now())" | Out-Null
  }
  $day5 = WarsawDay 5
  if (-not $day5) { Fail 'setup: could not compute the Warsaw day of claim 05' }

  Step 'supplier search through the form: ten rows and a pager'
  AgentLoginUi
  OpenList ''
  FillLabel 'Dostawca' $nameA
  ClickRole 'button' 'Szukaj'
  WaitUrl '**supplier=*'
  WaitText 'Strona 1 z 2'
  if ((Rows) -ne 10) { Fail "expected 10 rows on page 1, got $(Rows)" }
  Shot '01-page-1'

  Step 'Następna moves to page 2 and keeps the filter'
  ClickRole 'link' 'Następna'
  WaitText 'Strona 2 z 2'
  $url = CurUrl
  if ($url -notmatch 'page=2' -or $url -notmatch 'supplier=') { Fail "page 2 or the supplier filter missing from the URL: $url" }
  if ((Rows) -ne 2) { Fail "expected 2 rows on page 2, got $(Rows)" }
  Shot '02-page-2'

  Step 'supplier B only: five claims, no pager'
  OpenList "supplier=$(Enc $nameB)"
  WaitText $nameB
  if ((Rows) -ne 5) { Fail "expected 5 rows for supplier B, got $(Rows)" }
  ExpectNoText 'Strona 1 z' 'pager shown for a single page'

  Step 'status filter: draft lists two, sent lists ten (nine seeded and the real one)'
  OpenList "status=draft&supplier=$(Enc $nameA)"
  WaitText 'Szkic, nie wysłano'
  if ((Rows) -ne 2) { Fail "expected 2 draft rows, got $(Rows)" }
  OpenList "status=sent&supplier=$(Enc $nameA)"
  WaitText 'Wysłano, czekamy na dostawcę'
  if ((Rows) -ne 10) { Fail "expected 10 sent rows, got $(Rows)" }
  Shot '03-status'

  Step 'number search through the form: a claim number fragment, then an RMA (either)'
  OpenList ''
  FillLabel 'Numer' "sc-qa-$ts-05"
  ClickRole 'button' 'Szukaj'
  WaitUrl '**q=*'
  WaitText "SC-QA-$ts-05"
  if ((Rows) -ne 1) { Fail "expected 1 row for the claim number, got $(Rows)" }
  OpenList ''
  FillLabel 'Numer' $realRma.ToLower()
  ClickRole 'button' 'Szukaj'
  WaitUrl '**q=*'
  WaitText $realRma
  if ((Rows) -ne 1) { Fail "expected 1 row for the RMA, got $(Rows)" }
  Shot '04-number'

  Step 'creation day: one day returns exactly that claim, from after to returns nothing'
  OpenList "from=$day5&to=$day5&supplier=$(Enc $nameA)"
  WaitText "SC-QA-$ts-05"
  if ((Rows) -ne 1) { Fail "expected 1 row for $day5, got $(Rows)" }
  OpenList "from=$(WarsawDay 2)&to=$day5"
  WaitText 'Brak reklamacji dla wybranych filtrów'
  Shot '05-no-match'

  Step 'Wyczyść clears the text and date fields'
  OpenList "q=sc-qa&supplier=qa&from=$day5"
  ClickRole 'button' 'Wyczyść'
  # The click navigates on the client, so wait for the URL to lose the filters instead of reading it at once.
  foreach ($i in 1..20) { if ((CurUrl) -notmatch 'q=|supplier=|from=') { break }; Start-Sleep -Milliseconds 500 }
  if ((CurUrl) -match 'q=|supplier=|from=') { Fail "filters still in the URL: $(CurUrl)" }
  WaitText 'Reklamacje do dostawców'
  if (-not (EvalBool "['claim-filter-q','claim-filter-supplier','claim-filter-from','claim-filter-to'].map((id)=>document.getElementById(id).value).join('') === ''")) { Fail 'fields not emptied' }

  Step 'negative: invalid status, malformed date and bad page are handled'
  OpenList 'status=nie-ma&from=20.10.2026&page=abc'
  WaitText 'Nieznany status w filtrze'
  ExpectNoText 'Brak reklamacji dla wybranych filtrów' 'bad values narrowed the list'
  Write-Host "PASS: $QaId ($nameA)"
} finally { Invoke-QaCleanup }
