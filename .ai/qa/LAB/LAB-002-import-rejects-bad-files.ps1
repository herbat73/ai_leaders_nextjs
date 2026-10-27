# LAB-002: the lab rejects an invalid row (with line and column), a file with personal data, and a non-UTF-8 file.
# Scenario: .ai/qa/LAB/LAB-002-import-rejects-bad-files.md
# Native PowerShell twin of LAB-002-import-rejects-bad-files.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# Nothing is stored by the page, so there is nothing to clean up.
$QaId = 'LAB-002'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
$Header = 'case_ref,channel,kind,category,value_pln,opened_on,resolved_on,follow_up_requests,messages_exchanged,outcome'
$Good = 'S01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved'
$BadRow = New-TemporaryFile; $Pii = New-TemporaryFile; $Latin = New-TemporaryFile
Set-Content -Path $BadRow -Encoding utf8 -Value @($Header, $Good, 'S02,mail,return,nie-ma-takiej,"45,00",2026-07-02,2026-07-03,0,2,approved')
Set-Content -Path $Pii -Encoding utf8 -Value @($Header, $Good, 'S02,mail,return,clothing,"45,00",2026-07-02,2026-07-03,0,2,jan.nowak@example.pl')
$utf8 = [System.Text.UTF8Encoding]::new($false)
$bytes = $utf8.GetBytes("$Header`n$Good`nS02,mail,return,") + [byte[]](0xFF, 0xFE) + $utf8.GetBytes(",`"45,00`",2026-07-02,2026-07-03,0,2,approved`n")
[System.IO.File]::WriteAllBytes($Latin, $bytes)
$script:CleanupExtra = { Remove-Item -Force $BadRow, $Pii, $Latin -ErrorAction SilentlyContinue }
Initialize-Qa
try {
  Step 'agent opens the lab'
  AgentLoginUi
  Ab open "$BaseUrl/admin/discovery/case-sample" | Out-Null
  WaitText 'Próba przypadków'

  Step 'negative: an invalid category is reported with its line and column'
  Ab upload 'input[type=file]' $BadRow.FullName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot upload the CSV' }
  WaitText 'Plik zawiera błędy. Popraw je i wczytaj plik ponownie.'
  WaitText 'Kategoria: electronics, appliances, home, clothing, hygiene lub other'
  ExpectPageMatch '\n3\s+category' 'the error row does not point at line 3, column category'
  ExpectNoText 'Liczba spraw' 'results shown for a file with errors'
  Shot '01-row-error'

  Step 'negative: a file with personal data is rejected'
  Ab upload 'input[type=file]' $Pii.FullName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot upload the CSV' }
  WaitText 'Wiersz wygląda na dane osobowe'
  ExpectNoText 'jan.nowak' 'the personal data is echoed back on the page'
  ExpectNoText 'Liczba spraw' 'results shown for a file with personal data'
  Shot '02-personal-data'

  Step 'negative: a file that is not UTF-8 gets the encoding hint and no API call'
  Ab upload 'input[type=file]' $Latin.FullName | Out-Null; if ($LASTEXITCODE -ne 0) { Fail 'cannot upload the CSV' }
  WaitText 'Zapisz plik jako CSV UTF-8 i spróbuj ponownie'
  ExpectNoText 'Liczba spraw' 'results shown for a file with the wrong encoding'
  Shot '03-encoding'
  Write-Host "PASS: $QaId"
} finally { Invoke-QaCleanup }
