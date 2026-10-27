# CMP-003: an agent marks a received complaint "no defect": no supplier handover is offered and the complaint can be closed.
# Scenario: .ai/qa/CMP/CMP-003-agent-finds-no-defect.md
# Native PowerShell twin of CMP-003-agent-finds-no-defect.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
$QaId = 'CMP-003'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'setup: customer files a complaint through the API'
  ComplaintCreate 'PL-10005' 'maria.lewandowska@example.pl' 'L1'

  Step 'agent brings it to received'
  AgentLoginUi
  OpenCard $script:Rma
  ClickRole 'button' 'Zatwierdź'
  WaitText 'Zatwierdzone'
  ClickRole 'button' 'Oznacz jako w drodze'
  WaitText 'W drodze'

  Step 'received with no defect'
  ClickRole 'button' 'Odebrane: brak wady'
  WaitText 'Brak wady'
  Shot '01-no-defect'

  Step 'negative: no supplier handover is offered for a complaint without a defect'
  ExpectNoText 'Reklamacja do dostawcy' 'supplier section shown although no defect was confirmed'

  Step 'the complaint continues to resolved'
  ClickRole 'button' 'Zakończ'
  WaitText 'Zakończone'
  Shot '02-resolved'
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
