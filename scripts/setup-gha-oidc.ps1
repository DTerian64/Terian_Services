#requires -Version 5.1
<#
.SYNOPSIS
  Create the AAD App Registration + federated credential for GitHub Actions
  OIDC, used by the deploy-backend.yml workflow.

.DESCRIPTION
  Idempotent: re-running is safe — it detects an existing app and skips
  the create step.  Output at the end is the four values you need:
    - AZURE_CLIENT_ID         (set as GitHub repo secret)
    - AZURE_TENANT_ID         (set as GitHub repo secret)
    - AZURE_SUBSCRIPTION_ID   (set as GitHub repo secret)
    - PRINCIPAL_OBJECT_ID     (paste into terraform.tfvars as
                               github_actions_principal_id, then re-apply)

  No role assignments are made here — Terraform grants AcrPush and
  Container App Contributor on apply, once the object ID is in tfvars.

.PARAMETER AppDisplayName
  AAD app display name. Default: "terian-services-github-actions".

.PARAMETER GithubOrg
  GitHub org / username. Default: "DTerian64".

.PARAMETER GithubRepo
  GitHub repo name. Default: "Terian_Services".

.PARAMETER Branch
  Branch to bind the federated credential to. Default: "main".
#>

param(
  [string]$AppDisplayName = "terian-services-github-actions",
  [string]$GithubOrg      = "DTerian64",
  [string]$GithubRepo     = "Terian_Services",
  [string]$Branch         = "main"
)

$ErrorActionPreference = "Stop"

function Assert-AzOk {
  param([string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "az command failed at step: $Step (exit $LASTEXITCODE). Halting."
  }
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  GitHub Actions OIDC setup"                                     -ForegroundColor Cyan
Write-Host "  App name:    $AppDisplayName"                                  -ForegroundColor Cyan
Write-Host "  Repo:        $GithubOrg/$GithubRepo"                           -ForegroundColor Cyan
Write-Host "  Branch:      $Branch"                                          -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: ensure the App Registration exists ────────────────────────────
Write-Host "[1/5] Looking for existing App Registration..." -ForegroundColor Green
$existing = az ad app list --display-name $AppDisplayName --query "[0].appId" -o tsv
Assert-AzOk "List apps"

if ($existing) {
  Write-Host "      Found existing app: $existing"
  $AppId = $existing
} else {
  Write-Host "      Not found — creating..."
  $AppId = az ad app create --display-name $AppDisplayName --query appId -o tsv
  Assert-AzOk "Create app"
  Write-Host "      Created: $AppId"
}

# ── Step 2: ensure a service principal exists for the app ────────────────
Write-Host ""
Write-Host "[2/5] Ensuring service principal exists for the app..." -ForegroundColor Green
$SpId = az ad sp list --filter "appId eq '$AppId'" --query "[0].id" -o tsv
Assert-AzOk "List SP"

if (-not $SpId) {
  Write-Host "      No SP found — creating..."
  $SpId = az ad sp create --id $AppId --query id -o tsv
  Assert-AzOk "Create SP"
}
Write-Host "      SP object ID: $SpId"

# ── Step 3: create the federated credential for the main branch ──────────
Write-Host ""
Write-Host "[3/5] Creating federated credential for $GithubOrg/$GithubRepo branch '$Branch'..." -ForegroundColor Green

$FedName = "gha-$GithubRepo-$Branch"
$Subject = "repo:${GithubOrg}/${GithubRepo}:ref:refs/heads/$Branch"

$existingFed = az ad app federated-credential list --id $AppId --query "[?name=='$FedName'].name" -o tsv
Assert-AzOk "List federated creds"

if ($existingFed) {
  Write-Host "      Federated credential '$FedName' already exists. Skipping."
} else {
  $fedJson = @{
    name        = $FedName
    issuer      = "https://token.actions.githubusercontent.com"
    subject     = $Subject
    description = "GitHub Actions deploy-backend workflow"
    audiences   = @("api://AzureADTokenExchange")
  } | ConvertTo-Json -Depth 5 -Compress

  $tmp = [IO.Path]::GetTempFileName()
  Set-Content -Path $tmp -Value $fedJson -Encoding UTF8

  az ad app federated-credential create --id $AppId --parameters "@$tmp" | Out-Null
  Assert-AzOk "Create federated credential"
  Remove-Item $tmp -Force
  Write-Host "      Federated credential created."
}

# ── Step 4: capture subscription + tenant ─────────────────────────────────
Write-Host ""
Write-Host "[4/5] Capturing current subscription and tenant..." -ForegroundColor Green
$SubId    = az account show --query id       -o tsv
Assert-AzOk "Read subscription"
$TenantId = az account show --query tenantId -o tsv
Assert-AzOk "Read tenant"

# ── Step 5: print the summary ─────────────────────────────────────────────
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "  Done. Use the values below."                                   -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "GitHub repo secrets — set these at:"                             -ForegroundColor Yellow
Write-Host "  https://github.com/$GithubOrg/$GithubRepo/settings/secrets/actions" -ForegroundColor Yellow
Write-Host ""
Write-Host "  AZURE_CLIENT_ID         $AppId"                                -ForegroundColor White
Write-Host "  AZURE_TENANT_ID         $TenantId"                             -ForegroundColor White
Write-Host "  AZURE_SUBSCRIPTION_ID   $SubId"                                -ForegroundColor White
Write-Host "  TERIAN_ACR_NAME         acrterianservices"                     -ForegroundColor White
Write-Host "  TERIAN_BACKEND_RG       rg_corporate"                          -ForegroundColor White
Write-Host "  TERIAN_BACKEND_APP      terian-services-backend"               -ForegroundColor White
Write-Host ""
Write-Host "terraform.tfvars — add or update this line, then re-apply:"     -ForegroundColor Yellow
Write-Host ""
Write-Host "  github_actions_principal_id = `"$SpId`""                       -ForegroundColor White
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
