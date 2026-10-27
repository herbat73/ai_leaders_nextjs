# RET-004: submitting the same idempotency key twice returns the original request: one RMA, status 201 then 200.
# Scenario: .ai/qa/RET/RET-004-repeated-submit-creates-one-return.md
# Native PowerShell twin of RET-004-repeated-submit-creates-one-return.sh (same actions and assertions). Not run on the authoring machine (no pwsh).
# Prerequisites: .ai/scripts/test-env-up.ps1 exists (run om-prepare-test-env once on this platform); shared helpers in
# .ai/qa/lib/common.ps1.
# The return is created on seeded order PL-10001 (line L2); cleanup rejects it.
$QaId = 'RET-004'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Initialize-Qa
try {
  Step 'customer submits a return with a fresh idempotency key'
  GuestLookup 'PL-10001' 'anna.kowalska@example.pl'
  $body = ReturnJson 'L2'
  $first = GuestSubmit $body
  if ($first.Status -ne 201) { Fail "expected 201 for the first submit, got: $($first.Status) $($first.Body)" }
  $m = [regex]::Match($first.Body, '"rma":"(RMA-\d+-\d+)"')
  if (-not $m.Success) { Fail "no RMA in the first response: $($first.Body)" }
  $script:Rma = $m.Groups[1].Value
  Write-Host "created $($script:Rma)"

  Step 'the same request again returns the original (200, same RMA)'
  $second = GuestSubmit $body
  if ($second.Status -ne 200) { Fail "expected 200 for the replay, got: $($second.Status) $($second.Body)" }
  if ($second.Body -notmatch "`"rma`":`"$($script:Rma)`"") { Fail "the replay returned another RMA: $($second.Body)" }

  Step 'negative: a different key for the same, now held, line is a conflict (no second RMA)'
  $obj = $body | ConvertFrom-Json; $obj.idempotencyKey = (NewKey)
  $other = GuestSubmit ($obj | ConvertTo-Json -Depth 4)
  if ($other.Status -notin 409, 400) { Fail "expected 409/400 for the same line with a new key, got: $($other.Status) $($other.Body)" }

  Step 'the agent inbox lists the RMA exactly once'
  AgentLoginApi
  $list = (AgentApi 'GET' '/api/returns' $null).Json
  $items = if ($list.data.items) { $list.data.items } else { $list.data }
  $count = @($items | Where-Object { $_.rma -eq $script:Rma }).Count
  if ($count -ne 1) { Fail "expected one row for $($script:Rma), got $count" }
  Write-Host "PASS: $QaId ($($script:Rma))"
} finally { Invoke-QaCleanup }
