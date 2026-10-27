# CMP-002: an agent takes a complaint through approved -> in transit -> received and confirms the defect.
# Scenario: .ai/qa/CMP/CMP-002-agent-confirms-defect.md
# Native PowerShell twin of CMP-002-agent-confirms-defect.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
$QaId = 'CMP-002'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'setup: customer files a complaint through the API'
  ComplaintCreate 'PL-10005' 'maria.lewandowska@example.pl' 'L2'

  Step 'agent signs in and finds the complaint in the inbox as a complaint'
  AgentLoginUi
  OpenCard $script:Rma
  WaitText 'Opis wady'
  WaitText 'Jeszcze nie oceniono'
  Shot '01-card-submitted'

  Step 'negative: defect assessment is not offered before the item is received'
  ExpectNoSnap 'button "Odebrane: wada potwierdzona"' 'defect buttons shown before received'

  Step 'approve, mark in transit, then received with a confirmed defect'
  ClickRole 'button' 'Zatwierdź'
  WaitText 'Zatwierdzone'
  ClickRole 'button' 'Oznacz jako w drodze'
  WaitText 'W drodze'
  ExpectSnap 'button "Odebrane: wada potwierdzona"' 'no confirm-defect button once in transit'
  ClickRole 'button' 'Odebrane: wada potwierdzona'
  WaitText 'Wada potwierdzona'
  Shot '02-defect-confirmed'

  Step 'the supplier handover section is offered for a confirmed defect'
  WaitText 'Reklamacja do dostawcy'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
