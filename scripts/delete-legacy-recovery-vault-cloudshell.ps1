#requires -Version 7.0
<#
.SYNOPSIS
Cloud Shell adaptation of Azure's Delete_vault-m8qbevi0.ps1.
.DESCRIPTION
Read-only Azure preview by default. -Execute requires the exact vault ID.
Deletes cloud backup data/registrations in this vault only. Does not disable
soft delete, immutability or hybrid security; does not purge, delete resource
groups, delete private endpoints, or remove Site Recovery/on-premises setups.
Run by David in PowerShell Cloud Shell, already signed in to Terianix Platform.
#>
[CmdletBinding()]
param(
    [switch]$Execute,
    [string]$ConfirmVaultId,
    [ValidateRange(1,60)][int]$VerificationAttempts = 12,
    [ValidateRange(0,60)][int]$VerificationDelaySeconds = 10
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$subscriptionId = '4ddf12bb-5397-445f-bcaa-df4c7d3dfdca'
$tenantId = '5979eb86-9af1-4c74-8e50-acbe7d6a5cf9'
$resourceGroup = 'hub-spoke-demo'
$vaultName = 'vault-m8qbevi0'
$vaultId = "/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.RecoveryServices/vaults/$vaultName"

if ($Execute -and $ConfirmVaultId -cne $vaultId) {
    throw "Execution requires -ConfirmVaultId '$vaultId'. No Azure calls were made."
}
foreach ($moduleSpec in @(
    @{ Name='Az.Accounts'; Minimum=[version]'2.0.0' },
    @{ Name='Az.RecoveryServices'; Minimum=[version]'5.3.0' },
    @{ Name='Az.Network'; Minimum=[version]'4.15.0' }
)) {
    $modules = @(Get-Module -Name $moduleSpec.Name -ListAvailable | Sort-Object Version -Descending)
    if ($modules.Count -eq 0 -or $modules[0].Version -lt $moduleSpec.Minimum) {
        throw "Cloud Shell needs $($moduleSpec.Name) >= $($moduleSpec.Minimum). No module installation/uninstallation or execution-policy changes are automated."
    }
    Import-Module -Name $moduleSpec.Name -MinimumVersion $moduleSpec.Minimum
}
function Get-Field($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}
$initialContext = Get-AzContext
if ($null -eq $initialContext -or $initialContext.Tenant.Id -ne $tenantId) {
    throw "Start Cloud Shell as david.admin in Terianix Platform tenant $tenantId. No login is performed by this script."
}
# Context selection is local; use IDs, never ambiguous subscription names.
$vaultContext = Set-AzContext -SubscriptionId $subscriptionId -TenantId $tenantId -Scope Process
function Assert-VaultContext {
    $current = Get-AzContext
    if ($current.Subscription.Id -ne $subscriptionId -or $current.Tenant.Id -ne $tenantId) {
        throw 'Azure context changed. Stop; target-subscription operations are forbidden.'
    }
}
Assert-VaultContext
$vaults = @(Get-AzRecoveryServicesVault -Name $vaultName -ResourceGroupName $resourceGroup -DefaultProfile $vaultContext)
if ($vaults.Count -ne 1 -or $vaults[0].Id -ne $vaultId) {
    throw 'The exact legacy vault was not returned. No deletion was attempted.'
}
$vault = $vaults[0]
$properties = Get-AzRecoveryServicesVaultProperty -VaultId $vaultId -DefaultProfile $vaultContext

function Read-VaultAsrFabrics {
    # ASR context initialization can fail with a null reference in Cloud Shell.
    # Use the documented, vault-scoped GET instead; do NOT suppress that error
    # and assume the vault has no disaster-recovery dependencies.
    $fabricPath = "$vaultId/replicationFabrics"
    $path = "${fabricPath}?api-version=2025-02-01"
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $all = [System.Collections.Generic.List[object]]::new()
    for ($page=1; $page -le 100; $page++) {
        Assert-VaultContext
        if (-not $seen.Add($path)) { throw 'ASR pagination repeated a page. No absence is inferred.' }
        $response = Invoke-AzRestMethod -Path $path -Method GET -DefaultProfile $vaultContext
        if ([int](Get-Field $response 'StatusCode') -ne 200) {
            throw "ASR inventory GET failed (HTTP $(Get-Field $response 'StatusCode')). Stop; do not assume ASR is empty."
        }
        $body = [string](Get-Field $response 'Content') | ConvertFrom-Json
        # Access this property directly: a PowerShell helper returning [] would
        # enumerate it away, incorrectly turning a valid empty array into null.
        $valueProperty = $body.PSObject.Properties['value']
        if ($null -eq $valueProperty -or $valueProperty.Value -isnot [array]) {
            throw 'ASR response has no valid value array. Stop before writes.'
        }
        $values = $valueProperty.Value
        foreach ($fabric in $values) {
            $id = [string](Get-Field $fabric 'id')
            if (-not $id.StartsWith("$fabricPath/", [StringComparison]::OrdinalIgnoreCase) -or
                [string]::IsNullOrWhiteSpace($id.Substring($fabricPath.Length+1)) -or
                $id.Substring($fabricPath.Length+1).Contains('/')) {
                throw 'ASR inventory returned an unexpected fabric ID. Stop before writes.'
            }
            $all.Add([pscustomobject]@{
                Id=$id; Name=Get-Field $fabric 'name'
                FriendlyName=Get-Field (Get-Field $fabric 'properties') 'friendlyName'
            })
        }
        $next = [string](Get-Field $body 'nextLink')
        if ([string]::IsNullOrWhiteSpace($next)) { return $all.ToArray() }
        if ($next.StartsWith('/')) { $next = 'https://management.azure.com' + $next }
        $uri = [uri]$next
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or
            $uri.Host -ne 'management.azure.com' -or -not $uri.IsDefaultPort -or
            $uri.UserInfo -or $uri.Fragment -or $uri.AbsolutePath -ne $fabricPath) {
            throw 'ASR nextLink is outside the exact legacy vault. Stop before following it.'
        }
        $path = $uri.PathAndQuery
    }
    throw 'ASR pagination limit reached. No complete inventory was established.'
}

function Read-VaultContents {
    Assert-VaultContext
    # All discovery categories from Azure's generated script are retained.
    $contents = [ordered]@{}
    foreach ($spec in @(
        @{ Key='VM'; Management='AzureVM'; Workload='AzureVM' },
        @{ Key='SQL'; Management='AzureWorkload'; Workload='MSSQL' },
        @{ Key='Files'; Management='AzureStorage'; Workload='AzureFiles' },
        @{ Key='SAP'; Management='AzureWorkload'; Workload='SAPHanaDatabase' }
    )) {
        $contents[$spec.Key] = @(Get-AzRecoveryServicesBackupItem -BackupManagementType $spec.Management -WorkloadType $spec.Workload -VaultId $vaultId -DefaultProfile $vaultContext)
    }
    $contents['AutoSQL'] = @(Get-AzRecoveryServicesBackupProtectableItem -WorkloadType MSSQL -VaultId $vaultId -DefaultProfile $vaultContext | Where-Object { (Get-Field $_ 'IsAutoProtected') -eq $true })
    $contents['WorkloadContainers'] = @(Get-AzRecoveryServicesBackupContainer -ContainerType AzureVMAppContainer -VaultId $vaultId -DefaultProfile $vaultContext)
    $contents['StorageContainers'] = @(Get-AzRecoveryServicesBackupContainer -ContainerType AzureStorage -VaultId $vaultId -DefaultProfile $vaultContext)
    $contents['MARS'] = @(Get-AzRecoveryServicesBackupContainer -ContainerType Windows -BackupManagementType MAB -VaultId $vaultId -DefaultProfile $vaultContext)
    $contents['ManagementServers'] = @(Get-AzRecoveryServicesBackupManagementServer -VaultId $vaultId -DefaultProfile $vaultContext)
    $contents['PrivateEndpoints'] = @(Get-AzPrivateEndpointConnection -PrivateLinkResourceId $vaultId -DefaultProfile $vaultContext)
    $contents['ASRFabrics'] = @(Read-VaultAsrFabrics)
    return $contents
}
function Show-VaultContents($Contents) {
    Write-Host "Vault: $vaultId"
    Write-Host "Account: $($vaultContext.Account.Id)"
    Write-Host "Soft delete: $(Get-Field $properties 'SoftDeleteFeatureState')"
    foreach ($key in $Contents.Keys) {
        Write-Host "$key : $(@($Contents[$key]).Count)"
        foreach ($item in @($Contents[$key])) {
            [pscustomobject]@{
                Category=$key
                Name=Get-Field $item 'Name'
                FriendlyName=Get-Field $item 'FriendlyName'
                Id=Get-Field $item 'Id'
                SourceResourceId=Get-Field $item 'SourceResourceId'
                DeleteState=Get-Field $item 'DeleteState'
            } | Format-List | Out-String | Write-Host
        }
    }
}
function Assert-ReviewedContents($Contents) {
    foreach ($key in @('MARS','ManagementServers','PrivateEndpoints','ASRFabrics')) {
        if (@($Contents[$key]).Count -gt 0) {
            throw "$key require separate dependency/security review. No automated removal is provided for this category."
        }
    }
    foreach ($container in @($Contents['WorkloadContainers'])) {
        $workload = Get-Field (Get-Field $container 'ExtendedInfo') 'WorkloadType'
        if ($workload -notin @('SQL','SAPHana')) {
            throw 'An unreviewed workload container exists. Stop before writes.'
        }
    }
    foreach ($key in $Contents.Keys) {
        foreach ($item in @($Contents[$key])) {
            foreach ($field in @('SourceResourceId','VirtualMachineId','StorageAccountId')) {
                $source = [string](Get-Field $item $field)
                if ($source.StartsWith('/subscriptions/', [StringComparison]::OrdinalIgnoreCase) -and
                    -not $source.StartsWith("/subscriptions/$subscriptionId/", [StringComparison]::OrdinalIgnoreCase)) {
                    throw "A backup dependency points outside the legacy subscription ($key). Stop before writes."
                }
            }
        }
    }
}
# Wait only for jobs returned by this operation; never cancel existing jobs.
function Invoke-VaultChange([scriptblock]$Action) {
    Assert-VaultContext
    $results = @(& $Action)
    foreach ($result in $results) {
        if (Get-Field $result 'JobId') {
            $waited = @(Wait-AzRecoveryServicesBackupJob -Job $result -VaultId $vaultId -DefaultProfile $vaultContext -Timeout 600)
            $finished = @(Get-AzRecoveryServicesBackupJob -JobId $result.JobId -VaultId $vaultId -DefaultProfile $vaultContext)
            if ($finished.Count -ne 1 -or $finished[0].Status -ne 'Completed') {
                throw 'A backup cleanup job is not successfully completed. Earlier changes may have completed; inspect the vault before rerunning.'
            }
        }
    }
}
$contents = Read-VaultContents
Show-VaultContents $contents
if (-not $Execute) {
    Write-Host 'PREVIEW ONLY: no Azure resources, backup data or security settings were changed.'
    Write-Host 'Execution deletes all listed cloud backup data in this exact vault. Retention may prevent final vault deletion.'
    return
}
Assert-ReviewedContents $contents
$inProgress = @(Get-AzRecoveryServicesBackupJob -Status InProgress -VaultId $vaultId -DefaultProfile $vaultContext)
if ($inProgress.Count -gt 0) { throw 'Backup jobs are already in progress. Wait for them and rerun the preview; none are cancelled automatically.' }
Write-Warning 'Execution removes all listed cloud backups/recovery points and registrations in this vault. No new backup is made. Previous changes are not rolled back on failure.'

# Disable SQL auto-protection before deleting SQL backups, per Azure guidance.
foreach ($item in @($contents['AutoSQL'])) {
    Invoke-VaultChange { Disable-AzRecoveryServicesBackupAutoProtection -BackupManagementType AzureWorkload -WorkloadType MSSQL -InputItem $item -VaultId $vaultId -DefaultProfile $vaultContext -Confirm:$false }
}
foreach ($key in @('VM','SQL','SAP','Files')) {
    foreach ($item in @($contents[$key])) {
        if ((Get-Field $item 'DeleteState') -eq 'ToBeDeleted') {
            Write-Host "Already soft-deleted; retention is preserved: $(Get-Field $item 'FriendlyName')"
            continue
        }
        Invoke-VaultChange { Disable-AzRecoveryServicesBackupProtection -Item $item -VaultId $vaultId -DefaultProfile $vaultContext -RemoveRecoveryPoints -Force }
    }
}
# Use a fresh inventory before unregistering containers.
$remaining = Read-VaultContents
Assert-ReviewedContents $remaining
foreach ($key in @('VM','SQL','SAP','Files')) {
    $active = @($remaining[$key] | Where-Object { (Get-Field $_ 'DeleteState') -ne 'ToBeDeleted' })
    if ($active.Count -gt 0) {
        Show-VaultContents $remaining
        throw 'Active backup items remain. No container unregistration or vault deletion was attempted.'
    }
}
foreach ($key in @('WorkloadContainers','StorageContainers')) {
    foreach ($container in @($remaining[$key])) {
        Invoke-VaultChange { Unregister-AzRecoveryServicesBackupContainer -Container $container -VaultId $vaultId -DefaultProfile $vaultContext -Force }
    }
}
$remaining = Read-VaultContents
Assert-ReviewedContents $remaining
Show-VaultContents $remaining
$activeCount = 0
foreach ($key in @('VM','SQL','SAP','Files')) {
    $activeCount += @($remaining[$key] | Where-Object { (Get-Field $_ 'DeleteState') -ne 'ToBeDeleted' }).Count
}
$otherCount = 0
foreach ($key in @('AutoSQL','WorkloadContainers','StorageContainers','MARS','ManagementServers','PrivateEndpoints','ASRFabrics')) {
    $otherCount += @($remaining[$key]).Count
}
if ($activeCount -gt 0 -or $otherCount -gt 0) {
    throw 'Vault dependencies remain. No vault delete request was sent; review the inventory above.'
}
# Soft-deleted backup items may remain. The provider decides whether vault-level
# soft deletion is available; no retention bypass or fallback purge is attempted.
Assert-VaultContext
Remove-AzRecoveryServicesVault -Vault $vault -DefaultProfile $vaultContext -Confirm:$false
for ($attempt=1; $attempt -le $VerificationAttempts; $attempt++) {
    Assert-VaultContext
    # Successful list omission is evidence of absence from ACTIVE vaults only.
    # Never turn a failed read/403 into proof of deletion.
    $activeVaults = @(Get-AzRecoveryServicesVault -ResourceGroupName $resourceGroup -DefaultProfile $vaultContext)
    if (@($activeVaults | Where-Object { $_.Id -eq $vaultId }).Count -eq 0) {
        Write-Host 'The exact vault is absent from the active-vault list. It may be soft-deleted and retained by Azure; this is NOT proof of permanent purge.'
        Write-Host 'No resource group or other subscription resource was deleted.'
        return
    }
    if ($attempt -lt $VerificationAttempts) { Start-Sleep -Seconds $VerificationDelaySeconds }
}
throw 'Vault deletion was requested but active-vault absence is not yet verified. Inspect its state before retrying.'

