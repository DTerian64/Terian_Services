#requires -Version 5.1
<#
.SYNOPSIS
Save Terraform-generated SWA tokens before public DNS validation clears them.
.DESCRIPTION
Operator-run only. Reads one named output from the TARGET Terraform state.
Does not run init, plan, apply, or any Azure/Cloudflare command.
Writes ignored, dedicated token-input files for the target root and the
temporary source-DNS-validation root. It refuses to overwrite unrelated input
keys or change already saved tokens.
#>
[CmdletBinding()]
param(
    [string]$TargetTerraformRoot = (Join-Path $PSScriptRoot "..\terraform_terianix_platform\environments\prod"),
    [string]$SourceValidationRoot = (Join-Path $PSScriptRoot "..\terraform_terianix_platform\environments\source-domain-validation")
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$targetRoot = [IO.Path]::GetFullPath($TargetTerraformRoot)
$sourceRoot = [IO.Path]::GetFullPath($SourceValidationRoot)
$expectedDomains = @("terian-services.com", "www.terian-services.com", "terianix.ai", "www.terianix.ai")

Get-Command terraform -ErrorAction Stop | Out-Null
$raw = & terraform "-chdir=$targetRoot" output -json domain_validation_tokens
if ($LASTEXITCODE -ne 0) { throw "Could not read the target domain_validation_tokens output." }
$tokens = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
if (@($tokens.PSObject.Properties).Count -ne 4) {
    throw "Expected four target bindings. Apply the reviewed target preparation plan first."
}
$allTokens = [ordered]@{}
$sourceTokens = [ordered]@{}
foreach ($domain in $expectedDomains) {
    $property = $tokens.PSObject.Properties[$domain]
    if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        throw "Missing '$domain' token. Save tokens before public validation; do not recreate a live binding to regenerate them."
    }
    $allTokens[$domain] = [string]$property.Value
    if ($domain -in @("terian-services.com", "www.terian-services.com")) {
        $sourceTokens[$domain] = [string]$property.Value
    }
}

$destinations = @(
    @{ path = (Join-Path $targetRoot "domain-validation.auto.tfvars.json"); key = "domain_validation_tokens"; tokens = $allTokens },
    @{ path = (Join-Path $sourceRoot "domain-validation.auto.tfvars.json"); key = "terian_services_domain_validation_tokens"; tokens = $sourceTokens }
)
# Validate BOTH destinations before writing either file.
foreach ($destination in $destinations) {
    if (Test-Path -LiteralPath $destination.path) {
        $existing = Get-Content -LiteralPath $destination.path -Raw | ConvertFrom-Json
        $properties = @($existing.PSObject.Properties)
        if ($properties.Count -ne 1 -or $properties[0].Name -ne $destination.key) {
            throw "Refusing to overwrite unrelated inputs in $($destination.path)."
        }
        $saved = $properties[0].Value
        if (@($saved.PSObject.Properties).Count -ne $destination.tokens.Count) {
            throw "Existing saved token set differs in $($destination.path); inspect it manually."
        }
        foreach ($domain in $destination.tokens.Keys) {
            $savedProperty = $saved.PSObject.Properties[$domain]
            if ($null -eq $savedProperty -or [string]$savedProperty.Value -ne $destination.tokens[$domain]) {
                throw "Refusing to replace the saved token for '$domain'."
            }
        }
    }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($destination in $destinations) {
    $inputs = @{}
    $inputs[$destination.key] = $destination.tokens
    [IO.File]::WriteAllText($destination.path, ($inputs | ConvertTo-Json -Depth 10), $utf8)
    Write-Host "Saved token inputs: $($destination.path)"
}
Write-Host "No DNS changes made. Review and apply the target and temporary source validation plans separately."
