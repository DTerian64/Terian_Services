#requires -Version 5.1
<#
.SYNOPSIS
Configure the target GitHub Environment from the deployed Terianix stack.
.DESCRIPTION
Reads existing Terraform outputs and Azure resource metadata, then creates or
updates only the terianix-platform-prod GitHub Environment. Deployment tokens
are passed to gh through standard input and are never printed or written to
disk. Supports -WhatIf. Does not initialize, plan, apply, or deploy anything.
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$repository = "DTerian64/Terian_Services"
$environmentName = "terianix-platform-prod"
$expectedSubscription = "2bb69129-5e74-44d9-af68-96d45633f667"
$expectedTenant = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
$terraformRoot = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\terraform_terianix_platform\environments\prod")
)

function Invoke-MigrationCli {
    param([string]$Executable, [string[]]$Arguments)
    $result = & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed. Environment setup stopped."
    }
    return ($result -join [Environment]::NewLine).Trim()
}

function Get-OutputValue {
    param([object]$Outputs, [string]$Name)
    $property = $Outputs.PSObject.Properties[$Name]
    if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value.value)) {
        throw "Missing Terraform output '$Name'. Complete the target provisioning first."
    }
    return [string]$property.Value.value
}

foreach ($command in @("terraform", "az", "gh")) {
    Get-Command $command -ErrorAction Stop | Out-Null
}

$outputsJson = Invoke-MigrationCli "terraform" @("-chdir=$terraformRoot", "output", "-json")
$outputs = $outputsJson | ConvertFrom-Json
$subscription = Get-OutputValue $outputs "subscription_id"
$tenant = Get-OutputValue $outputs "tenant_id"
if ($subscription -ne $expectedSubscription -or $tenant -ne $expectedTenant) {
    throw "Terraform outputs do not describe the Terianix Platform subscription and tenant."
}

$account = (Invoke-MigrationCli "az" @("account", "show", "-o", "json")) | ConvertFrom-Json
if ($account.id -ne $subscription -or $account.tenantId -ne $tenant) {
    throw "Connect Azure CLI to subscription $subscription in tenant $tenant before running this script."
}
$repo = (Invoke-MigrationCli "gh" @("repo", "view", $repository, "--json", "nameWithOwner")) | ConvertFrom-Json
if ($repo.nameWithOwner -ne $repository) {
    throw "The GitHub connection does not match the migration repository."
}

$resourceGroup = Get-OutputValue $outputs "corporate_resource_group_name"
$clientId = Get-OutputValue $outputs "github_actions_client_id"
$terianHostname = Get-OutputValue $outputs "terian_services_frontend_hostname"
$terianixHostname = Get-OutputValue $outputs "terianix_frontend_hostname"
$backendHostname = Get-OutputValue $outputs "container_app_fqdn"
$identityQuery = "[?clientId=='$clientId']"
$identities = @((
    Invoke-MigrationCli "az" @("identity", "list", "--resource-group", $resourceGroup,
        "--subscription", $subscription, "--query", $identityQuery, "-o", "json")
) | ConvertFrom-Json)
if ($identities.Count -ne 1) {
    throw "The target GitHub managed identity could not be resolved from Terraform's client ID."
}
$credentials = (Invoke-MigrationCli "az" @("identity", "federated-credential", "list",
    "--identity-name", $identities[0].name, "--resource-group", $resourceGroup,
    "--subscription", $subscription, "-o", "json")) | ConvertFrom-Json
$expectedSubject = "repo:$repository" + ":environment:$environmentName"
$matchingCredentials = @($credentials | Where-Object {
    $_.subject -eq $expectedSubject -and
    $_.issuer -eq "https://token.actions.githubusercontent.com" -and
    $_.audiences -contains "api://AzureADTokenExchange"
})
if ($matchingCredentials.Count -eq 0) {
    throw "The target identity is missing the expected GitHub Environment federation."
}

# Resolve the target SWAs by their Terraform-provided hostnames to ensure that
# credentials and frontend URLs correspond to resources in this subscription.
$sites = (Invoke-MigrationCli "az" @("staticwebapp", "list", "--resource-group",
    $resourceGroup, "--subscription", $subscription, "-o", "json")) | ConvertFrom-Json
foreach ($hostname in @($terianHostname, $terianixHostname)) {
    $matches = @($sites | Where-Object { $_.defaultHostname -eq $hostname })
    if ($matches.Count -ne 1) {
        throw "The target Static Web App for $hostname was not found in $resourceGroup."
    }
}

$variables = [ordered]@{
    AZURE_CLIENT_ID = $clientId
    AZURE_TENANT_ID = $tenant
    AZURE_SUBSCRIPTION_ID = $subscription
    TERIAN_ACR_NAME = (Get-OutputValue $outputs "container_registry_name")
    TERIAN_BACKEND_RG = $resourceGroup
    TERIAN_BACKEND_APP = (Get-OutputValue $outputs "container_app_name")
    TERIAN_STORAGE_ACCOUNT = (Get-OutputValue $outputs "storage_account_name")
    VITE_API_URL = "https://$backendHostname"
    TERIANIX_VITE_API_URL = "https://$backendHostname"
    TERIAN_FRONTEND_HOSTNAME = $terianHostname
    TERIANIX_FRONTEND_HOSTNAME = $terianixHostname
}
$telemetryNames = [ordered]@{
    VITE_APPINSIGHTS_CONNECTION_STRING = "appi-terian-services-frontend-prod"
    TERIANIX_VITE_APPINSIGHTS_CONNECTION_STRING = "appi-terianix-frontend-prod"
}
foreach ($entry in $telemetryNames.GetEnumerator()) {
    $resourceId = "/subscriptions/$subscription/resourceGroups/$resourceGroup/providers/Microsoft.Insights/components/$($entry.Value)"
    $connectionString = Invoke-MigrationCli "az" @("resource", "show", "--ids", $resourceId,
        "--api-version", "2020-02-02", "--query", "properties.ConnectionString", "-o", "tsv")
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        throw "No connection string returned for target telemetry component $($entry.Value)."
    }
    $variables[$entry.Key] = $connectionString
}
$secrets = [ordered]@{
    TERIAN_SWA_DEPLOYMENT_TOKEN = (Get-OutputValue $outputs "terian_services_frontend_deployment_token")
    TERIANIX_SWA_DEPLOYMENT_TOKEN = (Get-OutputValue $outputs "terianix_frontend_deployment_token")
}

$endpoint = "repos/$repository/environments/$environmentName"
$names = Invoke-MigrationCli "gh" @("api", "repos/$repository/environments",
    "--paginate", "--jq", ".environments[].name")
$environmentExists = @($names -split "\r?\n") -contains $environmentName
if (-not $environmentExists -and $PSCmdlet.ShouldProcess(
    "$repository/$environmentName", "Create GitHub Environment with explicit deployment branches"
)) {
    $body = @{
        deployment_branch_policy = @{
            protected_branches = $false
            custom_branch_policies = $true
        }
    } | ConvertTo-Json -Depth 3 -Compress
    $body | & gh api --method PUT $endpoint --input - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Creating the target GitHub Environment failed." }
    $environmentExists = $true
}

if ($environmentExists) {
    $environment = (Invoke-MigrationCli "gh" @("api", $endpoint)) | ConvertFrom-Json
    if ($environment.deployment_branch_policy.custom_branch_policies) {
        $policyNames = Invoke-MigrationCli "gh" @("api", "$endpoint/deployment-branch-policies",
            "--paginate", "--jq", '.branch_policies[] | select(.type == "branch") | .name')
        foreach ($branch in @("terianix-platform", "main")) {
            if (@($policyNames -split "\r?\n") -notcontains $branch -and
                $PSCmdlet.ShouldProcess("$environmentName/$branch", "Allow deployment branch")) {
                Invoke-MigrationCli "gh" @("api", "--method", "POST",
                    "$endpoint/deployment-branch-policies", "-f", "name=$branch", "-f", "type=branch") | Out-Null
            }
        }
    } else {
        Write-Host "Existing environment branch rules preserved; ensure terianix-platform is allowed."
    }
}

foreach ($entry in $variables.GetEnumerator()) {
    if ($PSCmdlet.ShouldProcess("$environmentName/$($entry.Key)", "Set GitHub Environment variable")) {
        Invoke-MigrationCli "gh" @("variable", "set", $entry.Key, "--repo", $repository,
            "--env", $environmentName, "--body", $entry.Value) | Out-Null
    }
}
foreach ($entry in $secrets.GetEnumerator()) {
    if ($PSCmdlet.ShouldProcess("$environmentName/$($entry.Key)", "Set GitHub Environment secret")) {
        $entry.Value | & gh secret set $entry.Key --repo $repository --env $environmentName
        if ($LASTEXITCODE -ne 0) { throw "Setting the target frontend deployment secret failed." }
    }
}
Write-Host "Target Environment: $environmentName"
Write-Host "Target API: https://$backendHostname"
Write-Host "Frontend: https://$terianHostname"
Write-Host "Frontend: https://$terianixHostname"
Write-Host "Push the prepared terianix-platform branch to run the existing resource-specific workflows against the target."
