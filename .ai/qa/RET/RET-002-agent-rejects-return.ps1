# RET-002: an agent signs in, finds a submitted return in the inbox and rejects it with a reason.
# Scenario: .ai/qa/RET/RET-002-agent-rejects-return.md
# Native PowerShell twin of RET-002-agent-rejects-return.sh (same actions and assertions).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform) and
# .ai/qa/test-env.env (gitignored) holds TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD (see RET-001 header).
# Setup goes through the API; the rejection under test releases the held unit, and cleanup rejects the return when the
# run fails before that point.
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$QaDir = Join-Path $Root '.ai\qa'
$ArtDir = Join-Path $QaDir 'artifacts_RET-002'
$OrderNumber = 'PL-10001'
$OrderEmail = 'anna.kowalska@example.pl'
$ShortNote = 'Za krótko'
$Note = 'Zwrot odrzucony: automatyczny test RET-002, brak podstaw do zwrotu.'

$EnvFile = Join-Path $QaDir 'test-env.env'
if (-not (Test-Path $EnvFile)) { Write-Error "FAIL: $EnvFile missing (see RET-001 header)"; exit 2 }
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

$Session = "qa-ret-002-$PID"
$Rma = ''
$Rejected = $false
New-Item -ItemType Directory -Force -Path $ArtDir | Out-Null

function Ab { & $AgentBrowser --session $Session @args 2>&1 }
function Step($m) { Write-Host "-- $m" }
function Shot($n) { try { Ab screenshot --full (Join-Path $ArtDir "$n.png") | Out-Null } catch { } }
function Fail($m) { Shot 'failure'; throw "FAIL: $m" }
function CurrentUrl { (Ab get url | Select-Object -First 1) }
function WaitText($t) { Ab wait --text $t | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "expected text '$t' on $(CurrentUrl)" } }
function ClickRole($role, $name) { Ab find role $role click --name $name | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "no $role named '$name'" } }
function Snap { (Ab snapshot -i | Out-String) }
$Headers = @{ 'x-requested-with' = 'fetch' }

function AgentSession {
  $web = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = @{ email = $Creds['TEST_AGENT_EMAIL']; password = $Creds['TEST_AGENT_PASSWORD'] } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/agents/login" -Headers $Headers -ContentType 'application/json' -Body $login -WebSession $web | Out-Null
  $web
}

function Cleanup {
  try { Ab close | Out-Null } catch { }
  if (-not $Rma -or $Rejected) { return }
  $web = AgentSession
  $list = Invoke-RestMethod -Uri "$BaseUrl/api/returns" -WebSession $web
  $items = if ($list.data.items) { $list.data.items } else { $list.data }
  $row = $items | Where-Object { $_.rma -eq $Rma } | Select-Object -First 1
  if (-not $row) { throw "cleanup FAILED: $Rma not found in the agent list" }
  $body = @{ status = 'rejected'; decisionNote = 'RET-002 cleanup: automated test return, units released.' } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$BaseUrl/api/returns/$($row.id)" -Headers $Headers -ContentType 'application/json' -Body $body -WebSession $web | Out-Null
  Write-Host "cleanup: $Rma rejected"
}

try {
  Step 'setup: customer submits a return through the API'
  $guest = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $lookup = @{ orderNumber = $OrderNumber; email = $OrderEmail } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/returns/lookup" -Headers $Headers -ContentType 'application/json' -Body $lookup -WebSession $guest | Out-Null
  $submit = @{
    items = @(@{ lineRef = 'L2'; quantity = 1; reasonCode = 'size' })
    resolution = 'refund'; returnMethod = 'store'; acknowledged = $true; idempotencyKey = [guid]::NewGuid().ToString()
  } | ConvertTo-Json -Depth 5
  try {
    $created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/returns" -Headers $Headers -ContentType 'application/json' -Body $submit -WebSession $guest
  } catch { Fail "setup: return not created (a unit held by an open request? reject it first): $($_.Exception.Message)" }
  $Rma = $created.data.rma
  if (-not $Rma) { Fail 'setup: no RMA in the response' }
  Write-Host "created $Rma"

  Step 'agent signs in'
  Ab open "$BaseUrl/admin/login" | Out-Null
  WaitText 'Logowanie do panelu'
  Ab find label 'E-mail' fill $Creds['TEST_AGENT_EMAIL'] | Out-Null
  Ab find label 'Hasło' fill $Creds['TEST_AGENT_PASSWORD'] | Out-Null
  ClickRole 'button' 'Zaloguj się'
  Ab wait --url '**/admin/returns' | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'login did not reach the inbox' }
  WaitText 'Zwroty i reklamacje'

  Step 'the return is in the inbox as submitted'
  $inbox = Snap
  $m = [regex]::Match($inbox, "link `"$([regex]::Escape($Rma))`" \[ref=(e\d+)\]")
  if (-not $m.Success) { Fail "$Rma not listed in the inbox" }
  $href = (Ab get attr "@$($m.Groups[1].Value)" href | Select-Object -First 1)
  if ($href -notlike '/admin/returns/*') { Fail "unexpected link target for ${Rma}: $href" }
  Shot '01-inbox'

  # The RMA link wraps onto two lines in the narrow column, so a click at its box centre lands on the cell; open its href.
  Step 'open the decision card'
  Ab open "$BaseUrl$href" | Out-Null
  WaitText 'Decyzja'
  if ((Snap) -notmatch "heading `"$([regex]::Escape($Rma))`"") { Fail "decision card is not for $Rma" }

  Step 'negative: a short reason keeps the reject button disabled'
  ClickRole 'button' 'Odrzuć'
  Ab find label 'Uzasadnienie dla klienta' fill $ShortNote | Out-Null
  if ((Snap) -notmatch 'button "Odrzuć zgłoszenie" \[disabled') { Fail 'reject button enabled with a too short reason' }

  Step 'a long enough reason enables it; reject'
  Ab find label 'Uzasadnienie dla klienta' fill $Note | Out-Null
  $btn = (Snap -split "`n") | Where-Object { $_ -match 'button "Odrzuć zgłoszenie"' } | Select-Object -First 1
  if (-not $btn -or $btn -match 'disabled') { Fail 'reject button still disabled with a valid reason' }
  Shot '02-reject-form'
  ClickRole 'button' 'Odrzuć zgłoszenie'
  WaitText 'Odrzucone'
  $Rejected = $true
  WaitText $Note
  if ((Snap) -match 'button "Zatwierdź"') { Fail 'decision buttons still shown after rejecting' }
  Shot '03-rejected'

  Step 'the inbox shows the return as rejected'
  Ab open "$BaseUrl/admin/returns" | Out-Null
  WaitText $Rma
  # The status filter also contains the word "Odrzucone", so read this row's own status cell (4th cell after its link).
  $lines = (Snap) -split "`n"
  $at = [array]::FindIndex($lines, [Predicate[string]] { param($l) $l.Contains("link `"$Rma`"") })
  $cells = @($lines[($at + 1)..($lines.Count - 1)] | Where-Object { $_ -match 'cell "' }) | Select-Object -First 4
  if ($at -lt 0 -or $cells.Count -lt 4 -or $cells[3] -notmatch '"Odrzucone"') { Fail "inbox row for $Rma is not rejected: $($cells[3])" }

  Write-Host "PASS: RET-002 ($Rma)"
} finally {
  Cleanup
}
