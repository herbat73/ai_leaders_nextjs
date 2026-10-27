# AGT-001: a manager invites a new agent, the invitee sets a password and signs in; the one-time link works once.
# Scenario: .ai/qa/AGT/AGT-001-manager-invites-agent.md
# Native PowerShell twin of AGT-001-manager-invites-agent.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The invited e-mail is unique per run and the account is disabled in cleanup (agents are never deleted).
$QaId = 'AGT-001'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$NewEmail = "qa-invitee-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.test"
$NewName = 'QA Zaproszony'
$NewPassword = 'Qa-' + [Convert]::ToBase64String((1..12 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]).Replace('+','-').Replace('/','_').TrimEnd('=')
$script:CleanupExtra = { DisableAgentByEmail $NewEmail }
Initialize-Qa
try {
  Step 'manager opens the agents page'
  AgentLoginUi
  Ab open "$BaseUrl/admin/agents" | Out-Null
  WaitText 'Konta agentów'

  Step 'negative: an invitation without an e-mail is refused'
  ClickRole 'button' 'Zaproś agenta'
  ClickRole 'button' 'Wyślij zaproszenie'
  WaitText 'Podaj adres e-mail.'

  Step 'invite the new agent; the one-time link is shown'
  FillLabel 'E-mail' $NewEmail
  FillLabel 'Imię i nazwisko' $NewName
  ClickRole 'button' 'Wyślij zaproszenie'
  WaitText 'Zaproszenie gotowe'
  WaitText 'Link widzisz tylko raz'
  $js = @'
[...document.querySelectorAll('input,textarea,code,p,span')].map((e)=>e.value||e.textContent).find((v)=>v&&v.includes('/admin/invite/'))
'@
  $InviteUrl = ((Ab eval $js | Select-Object -Last 1) -replace '"', '')
  if ($InviteUrl -notlike '*/admin/invite/*') { Fail "invite link not found on the page (got: $InviteUrl)" }
  Shot '01-invite-link'

  Step 'invitee opens the link in another session and sets a password'
  Ab2 open $InviteUrl | Out-Null
  Ab2 wait --text 'Ustaw hasło' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'invite page did not load' }
  Step 'negative: a too short password is refused'
  Ab2 find label 'Hasło' fill 'krotkie' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no password field' }
  Ab2 find role button click --name 'Ustaw hasło i zaloguj się' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no submit button' }
  Ab2 wait --text 'Hasło musi mieć co najmniej' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no too-short message' }
  Ab2 find label 'Hasło' fill $NewPassword | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no password field' }
  Ab2 find role button click --name 'Ustaw hasło i zaloguj się' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'no submit button' }
  Ab2 wait --url '**/admin/returns' | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'accepting the invite did not sign the agent in' }
  Ab2 wait --text $NewName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'agent name not shown in the header' }
  try { Ab2 screenshot --full (Join-Path $script:ArtDir '02-invitee-signed-in.png') | Out-Null } catch { }

  Step 'negative: the same token cannot be accepted twice (invite_invalid)'
  $token = $InviteUrl.Substring($InviteUrl.LastIndexOf('/') + 1)
  $reuse = Api 'POST' '/api/agents/invite/accept' (@{ token = $token; password = $NewPassword } | ConvertTo-Json) $null
  if ($reuse.Body -notmatch '"code":"invite_invalid"') { Fail "used token not rejected with invite_invalid: $($reuse.Body)" }

  Step 'the manager sees the new agent as active'
  Ab open "$BaseUrl/admin/agents" | Out-Null
  WaitText $NewEmail
  Write-Host "PASS: $QaId ($NewEmail)"
} finally { Invoke-QaCleanup }
