# LAB-001: an agent imports a CSV sample in the case sample lab and reads the calculated results.
# Scenario: .ai/qa/LAB/LAB-001-agent-imports-a-sample-and-reads-results.md
# Native PowerShell twin of LAB-001-agent-imports-a-sample-and-reads-results.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The 10-case fixture is written to a temporary file with fixed values, so the expected counts never change.
$QaId = 'LAB-001'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$Csv = New-TemporaryFile
@'
case_ref,channel,kind,category,value_pln,opened_on,resolved_on,follow_up_requests,messages_exchanged,outcome
S01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved
S02,phone,return,other,"349,99",2026-07-02,2026-07-03,0,2,approved
S03,mail,complaint,electronics,"1200,00",2026-07-02,2026-07-12,3,9,partial
S04,mail,return,clothing,"45,00",2026-07-03,2026-07-04,0,2,approved
S05,phone,complaint,other,"199,00",2026-07-05,2026-07-09,1,4,rejected
S06,mail,transport,electronics,"650,00",2026-07-06,,2,6,open
S07,mail,return,clothing,"120,00",2026-07-07,2026-07-08,0,2,approved
S08,phone,missing,home,"75,50",2026-07-08,2026-07-10,1,3,cancelled
S09,mail,return,other,"230,00",2026-07-09,2026-07-12,1,4,rejected
S10,mail,complaint,home,"89,90",2026-07-10,2026-07-15,2,6,approved
'@ | Set-Content -Path $Csv -Encoding utf8
$script:CleanupExtra = { Remove-Item -Force $Csv -ErrorAction SilentlyContinue }
Initialize-Qa
try {
  Step 'agent opens the lab'
  AgentLoginUi
  Ab open "$BaseUrl/admin/discovery/case-sample" | Out-Null
  WaitText 'Próba przypadków'
  WaitText 'Pobierz szablon CSV'
  WaitText 'Nic nie jest zapisywane.'

  Step 'import the sample'
  Ab upload 'input[type=file]' $Csv.FullName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot upload the CSV' }
  WaitText 'Liczba spraw'
  WaitText 'Sprawy z dopytaniem'
  WaitText 'Mediana wiadomości'
  Shot '01-results'

  Step 'the tiles reflect the fixture: 10 cases, 70% with follow-ups, median 4 messages, 30% settled by a rule'
  ExpectPageMatch 'Liczba spraw\s+10' 'sample size tile is not 10'
  ExpectPageMatch 'Sprawy z dopytaniem\s+70%' 'follow-up share is not 70%'
  ExpectPageMatch 'Mediana wiadomości\s+4' 'median messages is not 4'
  ExpectPageMatch 'Rozstrzygnięte regułą\s+30%' 'rule-settled share is not 30%'

  Step 'the breakdowns and the rule table show the fixture counts'
  ExpectPageMatch 'Zwrot\s+5\s+50%' 'return count is not 5'
  ExpectPageMatch 'Reklamacja\s+3\s+30%' 'complaint count is not 3'
  ExpectPageMatch 'E-mail\s+7\s+70%' 'mail channel count is not 7'
  ExpectPageMatch 'R08\s+tak\s+3' 'R08 should match 3 cases at the baseline threshold'
  ExpectPageMatch 'R09\s+tak\s+0' 'R09 should match 0 cases at the baseline threshold'

  Step 'negative: the case table shows anonymous ids, never the source case references'
  foreach ($id in 'C01', 'C06', 'C10') { ExpectText $id "case $id missing from the table" }
  foreach ($id in 'S06', 'S10') { ExpectNoText $id "source case reference $id leaked into the page" }
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
