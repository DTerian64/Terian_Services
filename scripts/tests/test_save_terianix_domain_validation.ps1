#requires -Version 5.1
# Offline only: the Terraform command is a mock, and all writes go to test folders.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$tokenSaver = Join-Path $PSScriptRoot "..\save-terianix-domain-validation.ps1"
$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ("terianix-token-tests-" + [Guid]::NewGuid().ToString("N"))
$targetTestDirectory = Join-Path $testDirectory "target"
$sourceTestDirectory = Join-Path $testDirectory "source"
New-Item -ItemType Directory -Path $targetTestDirectory, $sourceTestDirectory | Out-Null
$global:terianixTokenTestState = [pscustomobject]@{
    failRead = $false
    values = @{
        "terian-services.com" = "terian-apex-test"
        "www.terian-services.com" = "terian-www-test"
        "terianix.ai" = "terianix-apex-test"
        "www.terianix.ai" = "terianix-www-test"
    }
}
function terraform {
    $cliArguments = @($args)
    if ($cliArguments.Count -ne 4 -or $cliArguments[1] -ne "output" -or
        $cliArguments[2] -ne "-json" -or $cliArguments[3] -ne "domain_validation_tokens") {
        throw "Only a named output read is permitted in this test."
    }
    $global:LASTEXITCODE = 0
    if ($global:terianixTokenTestState.failRead) {
        $global:LASTEXITCODE = 1
        return
    }
    return ($global:terianixTokenTestState.values | ConvertTo-Json)
}
function Assert-TokenTest {
    param([bool]$Condition, [string]$Message)
    if (!$Condition) { throw $Message }
}
function Invoke-TokenSaverTest {
    & $tokenSaver -TargetTerraformRoot $targetTestDirectory -SourceValidationRoot $sourceTestDirectory
}
Invoke-TokenSaverTest
$targetTokenFile = Join-Path $targetTestDirectory "domain-validation.auto.tfvars.json"
$sourceTokenFile = Join-Path $sourceTestDirectory "domain-validation.auto.tfvars.json"
$targetInputs = Get-Content -LiteralPath $targetTokenFile -Raw | ConvertFrom-Json
$sourceInputs = Get-Content -LiteralPath $sourceTokenFile -Raw | ConvertFrom-Json
Assert-TokenTest (@($targetInputs.domain_validation_tokens.PSObject.Properties).Count -eq 4) "Target tokens missing."
Assert-TokenTest (@($sourceInputs.terian_services_domain_validation_tokens.PSObject.Properties).Count -eq 2) "Source helper got unrelated domains."
Assert-TokenTest ($sourceInputs.terian_services_domain_validation_tokens.'terian-services.com' -eq "terian-apex-test") "Wrong source helper token."
$originalTargetHash = (Get-FileHash -LiteralPath $targetTokenFile).Hash
$originalSourceHash = (Get-FileHash -LiteralPath $sourceTokenFile).Hash
Invoke-TokenSaverTest
Assert-TokenTest ((Get-FileHash -LiteralPath $targetTokenFile).Hash -eq $originalTargetHash) "Idempotent save changed tokens."

foreach ($failure in @("empty", "changed", "read")) {
    if ($failure -eq "empty") { $global:terianixTokenTestState.values["terianix.ai"] = "" }
    if ($failure -eq "changed") { $global:terianixTokenTestState.values["terianix.ai"] = "different-token" }
    if ($failure -eq "read") { $global:terianixTokenTestState.failRead = $true }
    $threw = $false
    try { Invoke-TokenSaverTest } catch { $threw = $true }
    Assert-TokenTest $threw "Saver continued after $failure."
    Assert-TokenTest ((Get-FileHash -LiteralPath $targetTokenFile).Hash -eq $originalTargetHash) "Failure overwrote target inputs."
    Assert-TokenTest ((Get-FileHash -LiteralPath $sourceTokenFile).Hash -eq $originalSourceHash) "Failure overwrote source inputs."
    $global:terianixTokenTestState.values["terianix.ai"] = "terianix-apex-test"
    $global:terianixTokenTestState.failRead = $false
}
Write-Host "PASS: correct root inputs, idempotency, empty/changed-token rejection, and failed-read preservation."
Write-Host "Synthetic test files retained at: $testDirectory"
