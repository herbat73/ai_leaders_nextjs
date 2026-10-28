# AGT-003: a manager disables an agent; the agent's next request is refused, and nobody can disable their own account.
# Scenario: .ai/qa/AGT/AGT-003-manager-disables-agent.md
# Native PowerShell twin of AGT-003-manager-disables-agent.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Setup through the API: invite a unique agent and accept the invite (that agent's session is kept in its own web session).
$QaId = 'AGT-003'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$NewEmail = "qa-disable-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.test"
$NewPassword = 'Qa-' + [Convert]::ToBase64String((1..12 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]).Replace('+','-').Replace('/','_').TrimEnd('=')
$InviteeWeb = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:CleanupExtra = { DisableAgentByEmail $NewEmail }
Initialize-Qa
try {
  Step 'setup: invite a throw-away agent and accept the invite (API)'
  AgentLoginApi
  $invite = AgentApi 'POST' '/api/agents' (@{ email = $NewEmail; displayName = 'QA Do Wylaczenia'; permissions = @() } | ConvertTo-Json)
  $token = $invite.Json.data.inviteToken
  if (-not $token) { Fail "setup: invite not created: $($invite.Body)" }
  $accept = Api 'POST' '/api/agents/invite/accept' (@{ token = $token; password = $NewPassword } | ConvertTo-Json) $InviteeWeb
  if ($accept.Status -ne 200) { Fail "setup: invite not accepted ($($accept.Status))" }
  # PATCH checks authentication first (401), then existence (404): an unknown id proves the session is accepted.
  $probe = '{"status":"approved"}'
  if ((Api 'PATCH' '/api/returns/999999' $probe $InviteeWeb).Status -ne 404) { Fail 'setup: the new agent session is not accepted' }

  Step 'manager opens the agents page: the own row offers no disable action'
  AgentLoginUi
  Ab open "$BaseUrl/admin/agents" | Out-Null
  WaitText $NewEmail
  # The list is paginated (10 per page, newest first): the manager's own row is not on page 1, so find it through the search.
  FillLabel 'Szukaj po imieniu, nazwisku lub e-mailu' $script:Creds['TEST_AGENT_EMAIL']
  WaitText 'to Ty'
  FillLabel 'Szukaj po imieniu, nazwisku lub e-mailu' $NewEmail
  WaitText $NewEmail

  Step 'negative: the API refuses to disable the own account (self_disable)'
  $list = (AgentApi 'GET' '/api/agents' $null).Json
  $agents = if ($list.data.items) { $list.data.items } elseif ($list.data.agents) { $list.data.agents } else { $list.data }
  $self = $agents | Where-Object { $_.email -eq $script:Creds['TEST_AGENT_EMAIL'] } | Select-Object -First 1
  if (-not $self) { Fail 'own agent id not found' }
  $r = AgentApi 'PATCH' "/api/agents/$($self.id)" '{"status":"disabled"}'
  if ($r.Status -ne 409 -or $r.Body -notmatch 'self_disable') { Fail "expected 409 self_disable, got: $($r.Status) $($r.Body)" }

  Step 'disable the throw-away agent from its row'
  $found = $false; $ref = $null
  foreach ($line in ((Snap) -split "`n")) {
    if (-not $found) { if ($line.Contains($NewEmail)) { $found = $true }; continue }
    if ($line -match 'button "Wyłącz".*\[ref=(e\d+)\]') { $ref = $Matches[1]; break }
  }
  if (-not $ref) { Fail "no disable button in the row of $NewEmail" }
  Ab click "@$ref" | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot click the disable button' }
  WaitText 'Wyłączyć agenta'
  ClickRole 'button' 'Wyłącz agenta'
  WaitText 'Wyłączony'
  Shot '01-disabled'

  Step 'the disabled agent''s next request is refused'
  $code = (Api 'PATCH' '/api/returns/999999' $probe $InviteeWeb).Status
  if ($code -ne 401) { Fail "expected 401 for the disabled agent, got $code" }
  Write-Host "PASS: $QaId ($NewEmail)"
} finally { Invoke-QaCleanup }
