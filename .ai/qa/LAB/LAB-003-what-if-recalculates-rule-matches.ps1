# LAB-003: the what-if form recalculates the rule matches with other thresholds; a bad threshold is refused.
# Scenario: .ai/qa/LAB/LAB-003-what-if-recalculates-rule-matches.md
# Native PowerShell twin of LAB-003-what-if-recalculates-rule-matches.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Same 10-case fixture as LAB-001: at the baseline threshold R08 (150 zł) matches 3 returns (89, 45 and 120 zł); with a
# 50 zł threshold only the 45 zł return matches.
$QaId = 'LAB-003'
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
  Step 'agent imports the sample'
  AgentLoginUi
  Ab open "$BaseUrl/admin/discovery/case-sample" | Out-Null
  WaitText 'Próba przypadków'
  Ab upload 'input[type=file]' $Csv.FullName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot upload the CSV' }
  WaitText 'Scenariusz z innymi progami'
  ExpectPageMatch 'R08\s+tak\s+3' 'R08 baseline matches are not 3'

  Step 'negative: a threshold that is not an amount is refused'
  FillLabel 'Próg R08 (zwrot, zł)' 'abc'
  ClickRole 'button' 'Przelicz ponownie'
  WaitText 'Popraw progi i spróbuj ponownie'

  Step 'a 50 zł threshold leaves one R08 match in the scenario column'
  FillLabel 'Próg R08 (zwrot, zł)' '50,00'
  ClickRole 'button' 'Przelicz ponownie'
  WaitText 'Scenariusz:'
  ExpectPageMatch 'R08\s+tak\s+3\s+1' 'R08 should match 3 cases at baseline and 1 in the scenario'
  Shot '01-what-if'
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
