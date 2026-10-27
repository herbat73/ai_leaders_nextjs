# AGT-002: every login failure looks the same, repeated failures are throttled (429), and `next` cannot redirect off-site.
# Scenario: .ai/qa/AGT/AGT-002-login-rejects-bad-credentials-and-throttles.md
# Native PowerShell twin of AGT-002-login-rejects-bad-credentials-and-throttles.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Throttle budget: 10 attempts a minute per IP and 5 failures per 10 minutes per (e-mail, IP). The throttle check uses a unique
# unknown e-mail, so it never locks the QA account; this script makes 9 attempts, so wait a minute between runs.
$QaId = 'AGT-002'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$Ghost = "qa-ghost-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.test"
function Login-Wrong($email) { Api 'POST' '/api/agents/login' (@{ email = $email; password = 'zle-haslo-qa-1234' } | ConvertTo-Json) $null }
Initialize-Qa
try {
  Step 'negative: a wrong password and an unknown e-mail get the same message in the UI'
  Ab open "$BaseUrl/admin/login" | Out-Null
  WaitText 'Logowanie do panelu'
  FillLabel 'E-mail' $script:Creds['TEST_AGENT_EMAIL']
  FillLabel 'Hasło' 'zle-haslo-qa-1234'
  ClickRole 'button' 'Zaloguj się'
  WaitText 'Nieprawidłowy e-mail lub hasło'
  FillLabel 'E-mail' $Ghost
  ClickRole 'button' 'Zaloguj się'
  WaitText 'Nieprawidłowy e-mail lub hasło'
  ExpectText 'Logowanie do panelu' 'left the login page after a failed login'
  Shot '01-neutral-error'

  Step 'the API gives the same 401 code for an unknown e-mail'
  $r = Login-Wrong $Ghost
  if ($r.Status -ne 401 -or $r.Body -notmatch 'invalid_credentials') { Fail "expected 401 invalid_credentials, got: $($r.Status) $($r.Body)" }

  Step 'five failures for one e-mail lead to 429 rate_limited'
  1..4 | ForEach-Object { Login-Wrong $Ghost | Out-Null }
  $r = Login-Wrong $Ghost
  if ($r.Status -ne 429) { Fail "expected 429 after repeated failures, got $($r.Status)" }

  Step 'negative: a protocol-relative next parameter does not redirect off-site'
  Ab open "$BaseUrl/admin/login?next=//evil.example.test" | Out-Null
  WaitText 'Logowanie do panelu'
  FillLabel 'E-mail' $script:Creds['TEST_AGENT_EMAIL']
  FillLabel 'Hasło' $script:Creds['TEST_AGENT_PASSWORD']
  ClickRole 'button' 'Zaloguj się'
  Ab wait --url '**/admin/**' | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "login with a hostile next did not stay under /admin (at $(CurUrl))" }
  if (-not (CurUrl).StartsWith("$BaseUrl/admin")) { Fail "redirected off-site to $(CurUrl)" }
  Shot '02-stayed-on-site'
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
