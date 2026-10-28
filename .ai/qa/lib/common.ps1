# Shared helpers for the PowerShell QA scenario scripts in .ai/qa/<AREA>/. Dot-source it, do not run it.
# Native twin of common.sh: same steps, same assertions, no dependency on sh, WSL or Git Bash.
#
#   $QaId = 'CMP-001'
#   . (Join-Path $PSScriptRoot '..\lib\common.ps1')
#   Initialize-Qa
#   try { ...scenario... } finally { Invoke-QaCleanup }
#
# A script sets $script:Rma (and adds to $script:Rmas) to what it created so cleanup releases it, and may set
# $script:CleanupExtra to a script block. Needs .ai/qa/test-env.env (gitignored) with TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD.
$ErrorActionPreference = 'Stop'

$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$script:QaDir = Join-Path $script:Root '.ai\qa'
$script:Rma = ''
$script:Rmas = @()
$script:CleanupExtra = $null
$script:AgentApiLogged = $false
$script:AgentWeb = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:GuestWeb = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:Creds = @{}

function Initialize-Qa {
  $script:ArtDir = Join-Path $script:QaDir "artifacts_$QaId"
  $envFile = Join-Path $script:QaDir 'test-env.env'
  if (-not (Test-Path $envFile)) { Write-Error "FAIL: $envFile missing (needs TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD)"; exit 2 }
  Get-Content $envFile | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $script:Creds[$Matches[1]] = $Matches[2] } }
  $up = Join-Path $script:Root '.ai\scripts\test-env-up.ps1'
  if (-not (Test-Path $up)) { Write-Error 'FAIL: .ai/scripts/test-env-up.ps1 missing; run om-prepare-test-env once on this platform'; exit 2 }
  $out = (& $up 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { Write-Error "FAIL: test environment did not start`n$out"; exit 2 }
  $script:BaseUrl = ([regex]::Match($out, '(?m)^TEST_ENV_BASE_URL=(\S+)')).Groups[1].Value
  $descriptor = Get-Content (Join-Path $script:QaDir 'test-env.json') -Raw | ConvertFrom-Json
  $script:AgentBrowser = $descriptor.browser.command
  if (-not $script:BaseUrl -or -not (Test-Path $script:AgentBrowser)) { Write-Error 'FAIL: no base URL or agent-browser in the descriptor'; exit 2 }
  $script:Session = "qa-$($QaId.ToLower())-$PID"
  New-Item -ItemType Directory -Force -Path $script:ArtDir | Out-Null
}

function Ab { & $script:AgentBrowser --session $script:Session @args 2>&1 }
function Ab2 { & $script:AgentBrowser --session "$($script:Session)-2" @args 2>&1 }
function Step($m) { Write-Host "-- $m" }
function Shot($n) { try { Ab screenshot --full (Join-Path $script:ArtDir "$n.png") | Out-Null } catch { } }
function Fail($m) { Shot 'failure'; throw "FAIL: $m" }
function CurUrl { (Ab get url | Select-Object -First 1) }
function Snap { (Ab snapshot -i | Out-String) }
function WaitUrl($p) { Ab wait --url $p | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "expected URL $p, got $(CurUrl)" } }
function WaitText($t) { Ab wait --text $t | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "expected text '$t' on $(CurUrl)" } }
function ClickRole($role, $name) { Ab find role $role click --name $name | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "no $role named '$name'" } }
function FillLabel($label, $value) { Ab find label $label fill $value | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "no field labelled '$label'" } }
function ExpectSnap($pattern, $msg) { if ((Snap) -notmatch $pattern) { Fail $msg } }
function ExpectNoSnap($pattern, $msg) { if ((Snap) -match $pattern) { Fail $msg } }
function EvalBool($js) { ((Ab eval $js | Select-Object -Last 1) -eq 'true') }
function PageHas($text) { EvalBool ("document.body.innerText.includes('" + ($text -replace "'", "\'") + "')") }
function ExpectText($text, $msg) { if (-not (PageHas $text)) { Fail $msg } }
function ExpectNoText($text, $msg) { if (PageHas $text) { Fail $msg } }
function ExpectPageMatch($regex, $msg) { if (-not (EvalBool "/$regex/.test(document.body.innerText)")) { Fail $msg } }

# A native date input ignores `fill`; set it through the value setter React listens to, then fire `input`.
function FillDate($iso) {
  $js = "(()=>{const i=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'$iso');i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()"
  $got = (Ab eval $js | Select-Object -Last 1)
  if ($got -ne "`"$iso`"") { Fail "date input not set to $iso (got $got)" }
}
# After picking an option the select popup animates out and hides the page from the accessibility tree; wait for it.
function WaitListboxClosed {
  for ($i = 0; $i -le 20; $i++) {
    if (EvalBool "!document.querySelector('[role=listbox]')") { return }
    Ab wait 250 | Out-Null
  }
  Fail 'select popup did not close'
}

# HTTP helper: returns @{ Status; Body; Json } and never throws on a 4xx/5xx answer.
function Api($method, $path, $body, $web) {
  $params = @{ Method = $method; Uri = "$($script:BaseUrl)$path"; Headers = @{ 'x-requested-with' = 'fetch' }; ContentType = 'application/json'; UseBasicParsing = $true }
  if ($null -ne $body) { $params.Body = $body }
  if ($null -ne $web) { $params.WebSession = $web }
  try { $r = Invoke-WebRequest @params; $status = [int]$r.StatusCode; $text = $r.Content }
  catch [System.Net.WebException] {
    $status = [int]$_.Exception.Response.StatusCode
    $text = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
  }
  catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode; $text = "$($_.ErrorDetails.Message)" } else { throw } }
  $json = $null; try { $json = $text | ConvertFrom-Json } catch { }
  @{ Status = $status; Body = $text; Json = $json }
}
function NewKey { [guid]::NewGuid().ToString() }
function GuestLookup($order, $email) { Api 'POST' '/api/returns/lookup' (@{ orderNumber = $order; email = $email } | ConvertTo-Json) $script:GuestWeb | Out-Null }
function GuestSubmit($json) { Api 'POST' '/api/returns' $json $script:GuestWeb }
function ReturnJson($line) { @{ items = @(@{ lineRef = $line; quantity = 1; reasonCode = 'size' }); resolution = 'refund'; returnMethod = 'store'; acknowledged = $true; idempotencyKey = (NewKey) } | ConvertTo-Json -Depth 4 }

# Logs in once per script run: the login route is throttled (10 attempts a minute per IP).
function AgentLoginApi {
  if ($script:AgentApiLogged) { return }
  # On a warm server scripts finish in seconds and use up the 10 logins a minute; wait out the window and retry.
  for ($n = 0; $n -le 2; $n++) {
    $r = Api 'POST' '/api/agents/login' (@{ email = $script:Creds['TEST_AGENT_EMAIL']; password = $script:Creds['TEST_AGENT_PASSWORD'] } | ConvertTo-Json) $script:AgentWeb
    if ($r.Status -ne 429 -or $n -eq 2) { break }
    Write-Host 'agent API login throttled (429), waiting 65s'; Start-Sleep -Seconds 65
  }
  if ($r.Status -ne 200) { throw "FAIL: agent API login answered $($r.Status) (throttled? wait a minute)" }
  $script:AgentApiLogged = $true
}
function AgentApi($method, $path, $body) { Api $method $path $body $script:AgentWeb }
function ReturnRow($rma) {
  $list = (AgentApi 'GET' '/api/returns' $null).Json
  $items = if ($list.data.items) { $list.data.items } else { $list.data }
  $items | Where-Object { $_.rma -eq $rma } | Select-Object -First 1
}
function AgentMove($id, $status, $defectConfirmed) {
  $b = @{ status = $status }
  if ($null -ne $defectConfirmed) { $b.defectConfirmed = $defectConfirmed }
  (AgentApi 'PATCH' "/api/returns/$id" ($b | ConvertTo-Json)).Status
}

# Signs in through the browser as $email / $password. The login form is server-rendered, so its text can appear before
# hydration has finished and the fields then reset or are not yet found; retry the whole attempt up to three times.
function LoginUiAs($email, $password) {
  for ($n = 1; $n -le 3; $n++) {
    Ab open "$($script:BaseUrl)/admin/login" | Out-Null
    WaitText 'Logowanie do panelu'
    Ab find label 'E-mail' fill $email | Out-Null; $ok = ($LASTEXITCODE -eq 0)
    if ($ok) { Ab find label 'Hasło' fill $password | Out-Null; $ok = ($LASTEXITCODE -eq 0) }
    if ($ok) { Ab find role button click --name 'Zaloguj się' | Out-Null; $ok = ($LASTEXITCODE -eq 0) }
    if ($ok) { Ab wait --url '**/admin/returns' | Out-Null; $ok = ($LASTEXITCODE -eq 0) }
    if ($ok) { break }
    if ($n -eq 3) { Fail 'login did not reach the inbox' }
  }
  WaitText 'Zwroty i reklamacje'
}
function AgentLoginUi { LoginUiAs $script:Creds['TEST_AGENT_EMAIL'] $script:Creds['TEST_AGENT_PASSWORD'] }

# Opens the decision card of $rma from the inbox (the RMA link wraps in a narrow column, so open its href).
function OpenCard($rma) {
  Ab open "$($script:BaseUrl)/admin/returns" | Out-Null
  WaitText $rma
  $m = [regex]::Match((Snap), "link `"$([regex]::Escape($rma))`" \[ref=(e\d+)\]")
  if (-not $m.Success) { Fail "$rma not listed in the inbox" }
  $href = (Ab get attr "@$($m.Groups[1].Value)" href | Select-Object -First 1)
  if ($href -notlike '/admin/returns/*') { Fail "unexpected link target for ${rma}: $href" }
  Ab open "$($script:BaseUrl)$href" | Out-Null
  WaitText 'Decyzja'
}

# Files a complaint for one line through the API (guest session); sets $script:Rma.
function ComplaintCreate($order, $email, $line, $resolution = 'repair') {
  GuestLookup $order $email
  $body = @{ kind = 'complaint'; items = @(@{ lineRef = $line; quantity = 1 }); defectDescription = "Automatyczny test ${QaId}: produkt ma wade widoczna od pierwszego uzycia."; defectDiscoveredOn = (Get-Date -Format 'yyyy-MM-dd'); resolution = $resolution; returnMethod = 'courier'; acknowledged = $true; idempotencyKey = (NewKey) } | ConvertTo-Json -Depth 4
  $r = GuestSubmit $body
  $m = [regex]::Match($r.Body, '"rma":"(RMA-\d+-\d+)"')
  if (-not $m.Success) { Fail "setup: complaint not created (unit held by an open request?): $($r.Body)" }
  $script:Rma = $m.Groups[1].Value
  Write-Host "created $($script:Rma)"
}
# Walks a freshly created complaint to `received` through the API.
function ComplaintToReceived($defectConfirmed) {
  AgentLoginApi
  $script:Cid = (ReturnRow $script:Rma).id
  if (-not $script:Cid) { Fail "setup: $($script:Rma) not in the agent list" }
  foreach ($to in 'approved', 'in_transit') { if ((AgentMove $script:Cid $to $null) -ne 200) { Fail "setup: move to $to failed" } }
  if ((AgentMove $script:Cid 'received' $defectConfirmed) -ne 200) { Fail 'setup: move to received failed' }
}

# QA-only escape hatch on the disposable local test database: a request past `submitted` cannot be rejected or cancelled
# through the API, so its unit stays held for good. Not for app code.
function DbSql($sql) {
  if (Get-Command psql -ErrorAction SilentlyContinue) {
    $url = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { 'postgres://easyrms:easyrms@127.0.0.1:5433/easyrms' }
    & psql $url -qtAc $sql
  } else {
    Push-Location $script:Root; try { & docker compose exec -T postgres psql -U easyrms -d easyrms -qtAc $sql } finally { Pop-Location }
  }
}
function DbReleaseRma($rma) { DbSql "UPDATE return_requests SET status='rejected' WHERE rma='$rma' AND status IN ('approved','in_transit','received','in_service','resolved')" | Out-Null }

# Creates a supplier through the API with a unique name; sets $script:SupplierId and $script:SupplierName.
function SupplierCreate {
  $script:SupplierName = "QA $QaId $([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $r = AgentApi 'POST' '/api/suppliers' (@{ name = $script:SupplierName; email = 'reklamacje@qa-dostawca.example.pl'; guidelines = 'Wymagane wideo wady.' } | ConvertTo-Json)
  $script:SupplierId = $r.Json.data.supplier.id
  if (-not $script:SupplierId) { Fail "setup: supplier not created: $($r.Body)" }
}
# Creates the supplier claim for the current complaint (saved as `draft` under the log transport), then marks it `sent` in
# the test database: the answer flow under test starts from `sent`. Sets $script:ClaimId.
function ClaimCreateSent {
  $r = AgentApi 'POST' '/api/supplier-claims' (@{ returnId = [int]$script:Cid; supplierId = [int]$script:SupplierId } | ConvertTo-Json)
  $script:ClaimId = $r.Json.data.claim.id
  if (-not $script:ClaimId) { Fail "setup: supplier claim not created: $($r.Body)" }
  DbSql "UPDATE supplier_claims SET status='sent', sent_at=now() WHERE id=$($script:ClaimId) AND status='draft'" | Out-Null
}
function CleanupSupplier {
  if (-not $script:SupplierId) { return }
  AgentLoginApi
  $r = AgentApi 'PATCH' "/api/suppliers/$($script:SupplierId)" '{"active":false}'
  if ($r.Status -eq 200) { Write-Host "cleanup: supplier $($script:SupplierId) deactivated" } else { Write-Host "cleanup FAILED ($($r.Status)): deactivate supplier $($script:SupplierId) by hand" -ForegroundColor Red }
}
# Disables the agent with e-mail $email through the API (QA agents are never deleted, only disabled).
function DisableAgentByEmail($email) {
  AgentLoginApi
  $list = (AgentApi 'GET' '/api/agents' $null).Json
  $agents = if ($list.data.items) { $list.data.items } elseif ($list.data.agents) { $list.data.agents } else { $list.data }
  $agent = $agents | Where-Object { $_.email -eq $email } | Select-Object -First 1
  if (-not $agent) { return }
  $r = AgentApi 'PATCH' "/api/agents/$($agent.id)" '{"status":"disabled"}'
  if ($r.Status -eq 200) { Write-Host "cleanup: agent $email disabled" } else { Write-Host "cleanup FAILED ($($r.Status)): disable agent $email by hand" -ForegroundColor Red }
}

# Releases every unit held by the RMAs this run created: reject through the API while `submitted`, otherwise release in the
# test database (a rejection needs a note of 30+ characters).
function Invoke-QaCleanup {
  try { Ab close | Out-Null } catch { }
  try { Ab2 close | Out-Null } catch { }
  if ($script:CleanupExtra) { try { & $script:CleanupExtra } catch { Write-Host "cleanup FAILED: $_" -ForegroundColor Red } }
  foreach ($r in (@($script:Rma) + $script:Rmas | Where-Object { $_ })) {
    AgentLoginApi
    $row = ReturnRow $r
    if (-not $row) { Write-Host "cleanup FAILED: $r not found in the agent list" -ForegroundColor Red; continue }
    switch ($row.status) {
      { $_ -in 'rejected', 'cancelled' } { Write-Host "cleanup: $r already $($row.status)" }
      { $_ -in 'approved', 'in_transit', 'received', 'in_service', 'resolved' } { DbReleaseRma $r; Write-Host "cleanup: $r released in the test database" }
      default {
        $b = @{ status = 'rejected'; decisionNote = "$QaId cleanup: automated test request, units released." } | ConvertTo-Json
        $res = AgentApi 'PATCH' "/api/returns/$($row.id)" $b
        if ($res.Status -eq 200) { Write-Host "cleanup: $r rejected" } else { Write-Host "cleanup FAILED ($($res.Status)): reject $r by hand" -ForegroundColor Red }
      }
    }
  }
}
