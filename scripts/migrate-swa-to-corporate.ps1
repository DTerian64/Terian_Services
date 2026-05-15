#requires -Version 5.1
<#
.SYNOPSIS
  Move terian-services-frontend from rg_platform to rg_corporate.

.DESCRIPTION
  Azure SWA cross-RG move is blocked by attached custom domains, so this
  script detaches both apex and www custom domains, performs the move,
  re-points the apex A-alias DNS record at the new SWA resource ID, and
  reattaches both custom domains.  Apex HTTPS is offline for ~15-30 min
  during cert reprovisioning.

  The script aborts on the first failure (ErrorActionPreference=Stop plus
  $LASTEXITCODE checks after every az command).  If it halts mid-run, the
  step number and message tell you exactly where it stopped; recovery is
  by manual inspection of partial state, not blind re-run.

  Safe to re-run only after manual cleanup.  Not idempotent — the detach
  step will fail on the second run because the hostnames are already gone.

.PARAMETER NoConfirm
  Skip the initial confirmation prompt.  Use with caution: destructive
  operations follow immediately.
#>

param(
  [switch]$NoConfirm
)

$ErrorActionPreference = "Stop"

# ── Helper: abort if the most recent az command exited non-zero ───────────
function Assert-AzOk {
  param([string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "az command failed at step: $Step (exit $LASTEXITCODE). Halting."
  }
}

# ── Constants — edit if you ever re-purpose this script ───────────────────
$SwaName       = "terian-services-frontend"
$SourceRg      = "rg_platform"
$DestRg        = "rg_corporate"
$ZoneRg        = "rg_platform"
$ZoneName      = "terian-services.com"
$ApexHost      = "terian-services.com"
$WwwHost       = "www.terian-services.com"

# The current SWA apex validation token in DNS (what we added by hand).
# After move + reattach, a fresh token is generated and we swap them in DNS.
$OldApexToken  = "_zxwjrrzmoeyrgvo9zi2zvftkte8dpwh"

# ── Banner & confirmation ─────────────────────────────────────────────────
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  Terian Services - SWA cross-RG migration"                       -ForegroundColor Cyan
Write-Host "  Source:      $SourceRg"                                         -ForegroundColor Cyan
Write-Host "  Destination: $DestRg"                                           -ForegroundColor Cyan
Write-Host "  SWA:         $SwaName"                                          -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:"                                                       -ForegroundColor Yellow
Write-Host "  1. Detach apex + www custom domains  (HTTPS goes DOWN now)"     -ForegroundColor Yellow
Write-Host "  2. Move the SWA to $DestRg"                                     -ForegroundColor Yellow
Write-Host "  3. Update apex A-alias DNS record to the new SWA ID"            -ForegroundColor Yellow
Write-Host "  4. Reattach both domains  (cert reprovisions, 15-30 min)"       -ForegroundColor Yellow
Write-Host ""
Write-Host "Default *.azurestaticapps.net hostname stays up throughout."      -ForegroundColor Yellow
Write-Host ""

if (-not $NoConfirm) {
  $confirm = Read-Host "Proceed? (type 'yes' to continue)"
  if ($confirm -ne "yes") {
    Write-Host "Aborted by user." -ForegroundColor Red
    exit 1
  }
}

# ── Step 1: capture current SWA ID ────────────────────────────────────────
Write-Host ""
Write-Host "[1/8] Capturing current SWA ID..." -ForegroundColor Green
$SwaId = az staticwebapp show --name $SwaName --resource-group $SourceRg --query id -o tsv
Assert-AzOk "Capture SWA ID"
Write-Host "      SWA ID: $SwaId"

# ── Step 2: detach apex ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/8] Detaching $ApexHost (apex HTTPS goes DOWN now)..." -ForegroundColor Green
az staticwebapp hostname delete `
  --name $SwaName `
  --resource-group $SourceRg `
  --hostname $ApexHost --yes
Assert-AzOk "Detach apex"

# ── Step 3: detach www ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/8] Detaching $WwwHost..." -ForegroundColor Green
az staticwebapp hostname delete `
  --name $SwaName `
  --resource-group $SourceRg `
  --hostname $WwwHost --yes
Assert-AzOk "Detach www"

# ── Step 4: move the SWA ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/8] Moving the SWA from $SourceRg to $DestRg ..." -ForegroundColor Green
az resource move --destination-group $DestRg --ids $SwaId
Assert-AzOk "Move SWA"
Write-Host "      Move completed."

# ── Step 5: capture new SWA ID ────────────────────────────────────────────
Write-Host ""
Write-Host "[5/8] Capturing new SWA ID in $DestRg ..." -ForegroundColor Green
$NewSwaId = az staticwebapp show --name $SwaName --resource-group $DestRg --query id -o tsv
Assert-AzOk "Capture new SWA ID"
Write-Host "      New SWA ID: $NewSwaId"

# ── Step 6: re-point apex A-alias ────────────────────────────────────────
Write-Host ""
Write-Host "[6/8] Re-pointing apex A-alias DNS record to new SWA ID..." -ForegroundColor Green
az network dns record-set a update `
  --resource-group $ZoneRg `
  --zone-name $ZoneName `
  --name "@" `
  --target-resource $NewSwaId
Assert-AzOk "Update apex A-alias"

# ── Step 7: reattach apex + swap TXT token ───────────────────────────────
Write-Host ""
Write-Host "[7/8] Reattaching apex + swapping validation token..." -ForegroundColor Green

az staticwebapp hostname set `
  --name $SwaName `
  --resource-group $DestRg `
  --hostname $ApexHost `
  --validation-method dns-txt-token
Assert-AzOk "Reattach apex (initial)"

$NewApexToken = az staticwebapp hostname show `
  --name $SwaName `
  --resource-group $DestRg `
  --hostname $ApexHost `
  --query "validationToken" -o tsv
Assert-AzOk "Read new apex token"
Write-Host "      New apex validation token: $NewApexToken"

az network dns record-set txt remove-record `
  --resource-group $ZoneRg `
  --zone-name $ZoneName `
  --record-set-name "@" `
  --value $OldApexToken
Assert-AzOk "Remove old apex token from DNS"

az network dns record-set txt add-record `
  --resource-group $ZoneRg `
  --zone-name $ZoneName `
  --record-set-name "@" `
  --value $NewApexToken
Assert-AzOk "Add new apex token to DNS"

# ── Step 8: reattach www ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[8/8] Reattaching www..." -ForegroundColor Green
az staticwebapp hostname set `
  --name $SwaName `
  --resource-group $DestRg `
  --hostname $WwwHost `
  --validation-method cname-delegation
Assert-AzOk "Reattach www"

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "  Migration steps complete." -ForegroundColor Green
Write-Host "  apex + www are now bound to the SWA in '$DestRg'." -ForegroundColor Green
Write-Host "  Cert provisioning is in progress (15-30 min typical)." -ForegroundColor Green
Write-Host ""
Write-Host "  Poll status:" -ForegroundColor Green
Write-Host "    az staticwebapp hostname list --name $SwaName --resource-group $DestRg -o table" -ForegroundColor Green
Write-Host ""
Write-Host "  After both hostnames are 'Ready', reconcile Terraform state:" -ForegroundColor Green
Write-Host "    1. Edit terraform.tfvars:  swa_resource_group_name = `"$DestRg`"" -ForegroundColor Green
Write-Host "    2. terraform state rm module.static_web_app.azurerm_static_web_app.site" -ForegroundColor Green
Write-Host "    3. terraform state rm azurerm_static_web_app_custom_domain.apex" -ForegroundColor Green
Write-Host "    4. terraform state rm azurerm_static_web_app_custom_domain.www" -ForegroundColor Green
Write-Host "    5. terraform import module.static_web_app.azurerm_static_web_app.site '$NewSwaId'" -ForegroundColor Green
Write-Host "    6. terraform import azurerm_static_web_app_custom_domain.apex   '$NewSwaId/customDomains/$ApexHost'" -ForegroundColor Green
Write-Host "    7. terraform import azurerm_static_web_app_custom_domain.www    '$NewSwaId/customDomains/$WwwHost'" -ForegroundColor Green
Write-Host "    8. terraform plan  (should show no SWA changes, only backend creates)" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
