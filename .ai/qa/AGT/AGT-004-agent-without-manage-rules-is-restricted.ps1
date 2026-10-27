# AGT-004: an agent without the manage permission works the inbox but cannot reach agent management (page and API).
# Scenario: .ai/qa/AGT/AGT-004-agent-without-manage-rules-is-restricted.md
# Native PowerShell twin of AGT-004-agent-without-manage-rules-is-restricted.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The refund-approval limit (R11) is not covered here: it needs a refund above EASYRMS_REFUND_APPROVAL_LIMIT (2000 zł by default).
$QaId = 'AGT-004'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$NewEmail = "qa-plain-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.test"
$NewPassword = 'Qa-' + [Convert]::ToBase64String((1..12 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]).Replace('+','-').Replace('/','_').TrimEnd('=')
$PlainWeb = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:CleanupExtra = { DisableAgentByEmail $NewEmail }
Initialize-Qa
try {
  Step 'setup: invite an agent without permissions and accept the invite (API)'
  AgentLoginApi
  $invite = AgentApi 'POST' '/api/agents' (@{ email = $NewEmail; displayName = 'QA Bez Uprawnien'; permissions = @() } | ConvertTo-Json)
  $token = $invite.Json.data.inviteToken
  if (-not $token) { Fail "setup: invite not created: $($invite.Body)" }
  $accept = Api 'POST' '/api/agents/invite/accept' (@{ token = $token; password = $NewPassword } | ConvertTo-Json) $PlainWeb
  if ($accept.Status -ne 200) { Fail "setup: invite not accepted ($($accept.Status))" }

  Step 'the agent signs in through the browser and reaches the inbox'
  LoginUiAs $NewEmail $NewPassword

  Step 'negative: the navigation offers no agent management'
  ExpectNoSnap 'link "Agenci"' 'the Agenci link is shown to an agent without the manage permission'

  Step 'negative: the agents page shows no access'
  Ab open "$BaseUrl/admin/agents" | Out-Null
  WaitText 'Brak uprawnień'
  ExpectNoText 'Zaproś agenta' 'the invite action is offered to an agent without the permission'
  Shot '01-forbidden'

  Step 'negative: the agents API answers 403'
  $code = (Api 'GET' '/api/agents' $null $PlainWeb).Status
  if ($code -ne 403) { Fail "expected 403 from GET /api/agents, got $code" }
  Write-Host "PASS: $QaId ($NewEmail)"
} finally { Invoke-QaCleanup }
