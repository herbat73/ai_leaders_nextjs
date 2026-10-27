# RET-001: customer submits a return end to end (order lookup -> wizard -> RMA status page).
# Scenario: .ai/qa/RET/RET-001-customer-return-happy-path.md
# Native PowerShell twin of RET-001-customer-return-happy-path.sh (same actions and assertions).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform) and
# .ai/qa/test-env.env (gitignored) holds TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD (agent with MANAGE_RULES).
# Cleanup rejects the created return through PATCH /api/returns/[id] so its unit is released (D14).
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$QaDir = Join-Path $Root '.ai\qa'
$ArtDir = Join-Path $QaDir 'artifacts_RET-001'
$OrderNumber = 'PL-10001'
$OrderEmail = 'anna.kowalska@example.pl'
$ItemName = 'Skarpety'

$EnvFile = Join-Path $QaDir 'test-env.env'
if (-not (Test-Path $EnvFile)) { Write-Error "FAIL: $EnvFile missing (needs TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD)"; exit 2 }
$Creds = @{}
Get-Content $EnvFile | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $Creds[$Matches[1]] = $Matches[2] } }

$UpScript = Join-Path $Root '.ai\scripts\test-env-up.ps1'
if (-not (Test-Path $UpScript)) { Write-Error 'FAIL: .ai/scripts/test-env-up.ps1 missing; run om-prepare-test-env once on this platform'; exit 2 }
$EnvOut = (& $UpScript 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { Write-Error "FAIL: test environment did not start`n$EnvOut"; exit 2 }
$BaseUrl = ([regex]::Match($EnvOut, '(?m)^TEST_ENV_BASE_URL=(\S+)')).Groups[1].Value
$Descriptor = Get-Content (Join-Path $QaDir 'test-env.json') -Raw | ConvertFrom-Json
$AgentBrowser = $Descriptor.browser.command
if (-not $BaseUrl -or -not (Test-Path $AgentBrowser)) { Write-Error 'FAIL: no base URL or agent-browser in the descriptor'; exit 2 }

$Session = "qa-ret-001-$PID"
$Rma = ''
New-Item -ItemType Directory -Force -Path $ArtDir | Out-Null

function Ab { & $AgentBrowser --session $Session @args 2>&1 }
function Step($m) { Write-Host "-- $m" }
function Shot($n) { try { Ab screenshot --full (Join-Path $ArtDir "$n.png") | Out-Null } catch { } }
function Fail($m) { Shot 'failure'; throw "FAIL: $m" }
function CurrentUrl { (Ab get url | Select-Object -First 1) }
function WaitUrl($p) { Ab wait --url $p | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "expected URL $p, got $(CurrentUrl)" } }
function WaitText($t) { Ab wait --text $t | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "expected text '$t' on $(CurrentUrl)" } }
function ClickRole($role, $name) { Ab find role $role click --name $name | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "no $role named '$name'" } }
function Headers { @{ 'x-requested-with' = 'fetch' } }

function Cleanup {
  try { Ab close | Out-Null } catch { }
  if (-not $Rma) { return }
  $web = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = @{ email = $Creds['TEST_AGENT_EMAIL']; password = $Creds['TEST_AGENT_PASSWORD'] } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/agents/login" -Headers (Headers) -ContentType 'application/json' -Body $login -WebSession $web | Out-Null
  $list = Invoke-RestMethod -Uri "$BaseUrl/api/returns" -WebSession $web
  $items = if ($list.data.items) { $list.data.items } else { $list.data }
  $row = $items | Where-Object { $_.rma -eq $Rma } | Select-Object -First 1
  if (-not $row) { throw "cleanup FAILED: $Rma not found in the agent list" }
  $body = @{ status = 'rejected'; decisionNote = 'RET-001 cleanup: automated test return, units released.' } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$BaseUrl/api/returns/$($row.id)" -Headers (Headers) -ContentType 'application/json' -Body $body -WebSession $web | Out-Null
  Write-Host "cleanup: $Rma rejected"
}

try {
  Step 'open the lookup page'
  Ab open "$BaseUrl/" | Out-Null
  WaitText 'Zwrot zamówienia'

  Step 'look up the order'
  Ab find label 'Numer zamówienia' fill $OrderNumber | Out-Null
  Ab find label 'Adres e-mail' fill $OrderEmail | Out-Null
  ClickRole 'button' 'Sprawdź zamówienie'
  WaitUrl '**/returns'
  WaitText 'Twoje zgłoszenia'
  Shot '01-returns-list'

  Step 'start a return and pick one item'
  ClickRole 'link' 'Rozpocznij zwrot'
  WaitUrl '**/returns/new'
  WaitText 'Które produkty chcesz zwrócić?'
  Ab find role checkbox click --name $ItemName | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "item '$ItemName' not selectable (unit held by an open return? reject it first)" }
  ClickRole 'button' 'Dalej'
  WaitText 'Dlaczego zwracasz'

  Step 'reason, shipping, resolution'
  ClickRole 'radio' 'Nieodpowiedni rozmiar'
  ClickRole 'button' 'Dalej'
  WaitText 'Jak odeślesz paczkę?'
  ClickRole 'radio' 'Zwrot w sklepie'
  ClickRole 'button' 'Dalej'
  WaitText 'Co chcesz otrzymać?'
  ClickRole 'radio' 'Zwrot pieniędzy'
  WaitText 'Szacowana kwota zwrotu'   # the quote loads asynchronously; an earlier 'Dalej' click is ignored
  ClickRole 'button' 'Dalej'
  WaitText 'Sprawdź i wyślij zgłoszenie'
  Shot '02-summary'

  Step 'negative: submit without confirming stays on the summary'
  ClickRole 'button' 'Wyślij zgłoszenie'
  Start-Sleep -Seconds 1
  if ((CurrentUrl) -notlike '*/returns/new') { Fail 'submitted without the confirmation checkbox' }
  WaitText 'Sprawdź i wyślij zgłoszenie'

  Step 'confirm and submit'
  ClickRole 'checkbox' 'Potwierdzam'
  ClickRole 'button' 'Wyślij zgłoszenie'
  WaitUrl '**/returns/RMA-*'
  $m = [regex]::Match((CurrentUrl), '/returns/(RMA-\d+-\d+)')
  if (-not $m.Success) { Fail 'no RMA number in the URL' }
  $Rma = $m.Groups[1].Value
  Write-Host "created $Rma"

  Step 'status page shows the new return as submitted'
  WaitText 'Aktualny status: Zgłoszone'
  WaitText 'Skarpety'
  Shot '03-status'

  Write-Host "PASS: RET-001 ($Rma)"
} finally {
  Cleanup
}
