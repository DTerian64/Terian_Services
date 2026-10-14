#requires -Version 7.0
# Fully offline: every Azure command and module load used by the script is mocked.
$ErrorActionPreference = 'Stop'
$scriptUnderTest = Join-Path $PSScriptRoot '../delete-legacy-recovery-vault-cloudshell.ps1'
$legacy = '4ddf12bb-5397-445f-bcaa-df4c7d3dfdca'
$target = '2bb69129-5e74-44d9-af68-96d45633f667'
$tenant = '5979eb86-9af1-4c74-8e50-acbe7d6a5cf9'
$exactVault = "/subscriptions/$legacy/resourceGroups/hub-spoke-demo/providers/Microsoft.RecoveryServices/vaults/vault-m8qbevi0"
function Reset-Test {
    $global:fixture = @{
        Tenant=$tenant; Subscription=$target; Writes=0; Calls=0; Backup=$false;
        Soft=$false; Deleted=$false; ASR=$false; PE=$false; MARS=$false;
        Container=$false; UnknownContainer=$false; ExternalSource=$false;
        ReadFails=$false; JobFails=$false; DeleteFails=$false;
        Persist=$false; WrongVault=$false; ContextDrift=$false; AutoSQL=$false;
        AsrHttp=200; AsrBadJson=$false; AsrBadShape=$false; AsrPaged=$false;
        AsrPageCalls=0; AsrUnsafeNext=$false; AsrRepeatNext=$false; AsrWrongId=$false;
        AutoDisabled=$false; Trace=[System.Collections.Generic.List[string]]::new()
    }
}
function global:Get-Module { param($Name,[switch]$ListAvailable)
    [pscustomobject]@{Name=$Name;Version=[version]'100.0.0'}
}
function global:Import-Module { param($Name,$MinimumVersion) }
function global:Get-AzContext {
    $fixture.Calls++
    $sub = $fixture.Subscription
    if ($fixture.ContextDrift -and $fixture.Calls -gt 5) { $sub=$target }
    [pscustomobject]@{Tenant=[pscustomobject]@{Id=$fixture.Tenant}; Subscription=[pscustomobject]@{Id=$sub}; Account=[pscustomobject]@{Id='david.admin@terianix.onmicrosoft.com'}}
}
function global:Set-AzContext { param($SubscriptionId,$TenantId,$Scope)
    if ($SubscriptionId -ne $legacy -or $TenantId -ne $tenant) { throw 'Unsafe context selection.' }
    $fixture.Subscription=$SubscriptionId
    Get-AzContext
}
function global:Get-AzRecoveryServicesVault { param($Name,$ResourceGroupName,$DefaultProfile)
    $fixture.Calls++
    if ($fixture.ReadFails) { throw 'Mock AuthorizationFailed' }
    if ($ResourceGroupName -ne 'hub-spoke-demo') { throw 'Wrong group.' }
    if ($fixture.Deleted -and -not $fixture.Persist) { return }
    $id=$exactVault
    if ($fixture.WrongVault) { $id=$id.Replace($legacy,$target) }
    [pscustomobject]@{Id=$id;Name='vault-m8qbevi0'}
}
function global:Get-AzRecoveryServicesVaultProperty { param($VaultId,$DefaultProfile)
    if ($VaultId -ne $exactVault) { throw 'Wrong vault properties.' }
    [pscustomobject]@{SoftDeleteFeatureState='AlwaysON'}
}
function global:Set-AzRecoveryServicesAsrVaultContext { param($Vault)
    throw 'Regression: ASR context must not be initialized (reported Cloud Shell null reference).'
}
function global:Get-AzRecoveryServicesBackupItem { param($BackupManagementType,$WorkloadType,$VaultId,$DefaultProfile)
    if ($VaultId -ne $exactVault) { throw 'Wrong backup vault.' }
    if ($fixture.Backup -and $WorkloadType -eq 'AzureVM') {
        $source="/subscriptions/$legacy/resourceGroups/demo/providers/Microsoft.Compute/virtualMachines/old-vm"
        if ($fixture.ExternalSource) { $source=$source.Replace($legacy,$target) }
        [pscustomobject]@{Name='old-vm';FriendlyName='old-vm';Id="$exactVault/backupFabrics/Azure/protectionContainers/vm/protectedItems/vm";DeleteState=$(if($fixture.Soft){'ToBeDeleted'}else{'NotDeleted'});SourceResourceId=$source}
    }
}
function global:Get-AzRecoveryServicesBackupProtectableItem { param($WorkloadType,$VaultId,$DefaultProfile)
    if ($fixture.AutoSQL -and -not $fixture.AutoDisabled) { [pscustomobject]@{Name='SQL';IsAutoProtected=$true} }
}
function global:Get-AzRecoveryServicesBackupContainer { param($ContainerType,$BackupManagementType,$VaultId,$DefaultProfile)
    if ($fixture.MARS -and $ContainerType -eq 'Windows') { [pscustomobject]@{Name='MARS'} }
    if ($fixture.Container -and $ContainerType -eq 'AzureVMAppContainer') {
        [pscustomobject]@{Name='sql';ExtendedInfo=[pscustomobject]@{WorkloadType=$(if($fixture.UnknownContainer){'Unknown'}else{'SQL'})}}
    }
}
function global:Get-AzRecoveryServicesBackupManagementServer { param($VaultId,$DefaultProfile) }
function global:Get-AzPrivateEndpointConnection { param($PrivateLinkResourceId,$DefaultProfile)
    if ($fixture.PE) { [pscustomobject]@{Name='connection';Id="$exactVault/privateEndpointConnections/connection"} }
}
function global:Get-AzRecoveryServicesAsrFabric { param($DefaultProfile)
    throw 'Regression: use the scoped ASR REST inventory, not the context-dependent cmdlet.'
}
function global:Invoke-AzRestMethod { param($Path,$Method,$DefaultProfile)
    if ($Method -ne 'GET' -or -not $Path.StartsWith("$exactVault/replicationFabrics?")) { throw 'Unsafe REST call.' }
    $fixture.AsrPageCalls++
    $values=@()
    if ($fixture.ASR -or ($fixture.AsrPaged -and $fixture.AsrPageCalls -eq 2)) {
        $fabricId="$exactVault/replicationFabrics/fabric"
        if ($fixture.AsrWrongId) { $fabricId=$fabricId.Replace($legacy,$target) }
        $values=@([pscustomobject]@{id=$fabricId;name='fabric';properties=[pscustomobject]@{friendlyName='fabric'}})
    }
    $body=@{value=$values}
    if ($fixture.AsrPaged -and $fixture.AsrPageCalls -eq 1) { $body.nextLink="https://management.azure.com$exactVault/replicationFabrics?api-version=2025-02-01&skiptoken=2" }
    if ($fixture.AsrUnsafeNext) { $body.nextLink="https://management.azure.com$($exactVault.Replace($legacy,$target))/replicationFabrics?api-version=2025-02-01" }
    if ($fixture.AsrRepeatNext) { $body.nextLink="https://management.azure.com$exactVault/replicationFabrics?api-version=2025-02-01" }
    if ($fixture.AsrBadShape) { $body=@{error='missing value'} }
    $content=ConvertTo-Json -InputObject $body -Depth 6 -Compress
    if ($fixture.AsrBadJson) { $content='not json' }
    [pscustomobject]@{StatusCode=$fixture.AsrHttp;Content=$content}
}
function global:Get-AzRecoveryServicesBackupJob { param($Status,$VaultId,$DefaultProfile,$JobId)
    if ($JobId) { [pscustomobject]@{JobId=$JobId;Status=$(if($fixture.JobFails){'Failed'}else{'Completed'})} }
}
function global:Wait-AzRecoveryServicesBackupJob { param($Job,$VaultId,$DefaultProfile,$Timeout)
    if ($VaultId -ne $exactVault) { throw 'Wrong job vault.' }
}
function global:Disable-AzRecoveryServicesBackupAutoProtection { param($BackupManagementType,$WorkloadType,$InputItem,$VaultId,$DefaultProfile,$Confirm)
    $fixture.Writes++; $fixture.AutoDisabled=$true; $fixture.Trace.Add('AutoProtection')
}
function global:Disable-AzRecoveryServicesBackupProtection { param($Item,$VaultId,$DefaultProfile,[switch]$RemoveRecoveryPoints,[switch]$Force)
    if ($VaultId -ne $exactVault -or -not $RemoveRecoveryPoints) { throw 'Unsafe backup delete.' }
    $fixture.Writes++; $fixture.Soft=$true; $fixture.Trace.Add('Backup')
    [pscustomobject]@{JobId='cleanup-job'}
}
function global:Unregister-AzRecoveryServicesBackupContainer { param($Container,$VaultId,$DefaultProfile,[switch]$Force)
    $fixture.Writes++; $fixture.Container=$false; $fixture.Trace.Add('Unregister')
}
function global:Remove-AzRecoveryServicesVault { param($Vault,$DefaultProfile,$Confirm)
    if ($Vault.Id -ne $exactVault) { throw 'Unsafe vault delete.' }
    $fixture.Writes++; $fixture.Trace.Add('Vault')
    if ($fixture.DeleteFails) { throw 'Mock provider retention block' }
    $fixture.Deleted=$true
}
function global:Start-Sleep { param($Seconds) }
function Run-TestScript([switch]$Execute) {
    if ($Execute) { & $scriptUnderTest -Execute -ConfirmVaultId $exactVault -VerificationAttempts 2 -VerificationDelaySeconds 0 *> $null }
    else { & $scriptUnderTest *> $null }
}
function Assert-Test([bool]$Condition,[string]$Message) { if(-not $Condition){throw $Message} }
function Expect-Stop([scriptblock]$Action,[string]$Message) {
    $stopped=$false
    try { & $Action } catch { $stopped=$true }
    Assert-Test $stopped $Message
}
$passed=0
Reset-Test; $fixture.Backup=$true; Run-TestScript
Assert-Test ($fixture.Writes -eq 0) 'Preview wrote to Azure.'; $passed++
Reset-Test; Expect-Stop { & $scriptUnderTest -Execute *> $null } 'Missing confirmation did not stop.'
Assert-Test ($fixture.Calls -eq 0) 'Missing confirmation made Azure calls.'; $passed++
Reset-Test; $fixture.Tenant='wrong'; Expect-Stop {Run-TestScript -Execute} 'Wrong tenant accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Wrong tenant wrote.'; $passed++
Reset-Test; $fixture.WrongVault=$true; Expect-Stop {Run-TestScript -Execute} 'Target vault accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Target vault wrote.'; $passed++
Reset-Test; $fixture.ReadFails=$true; Expect-Stop {Run-TestScript -Execute} '403 hidden.'
Assert-Test ($fixture.Writes -eq 0) 'Read failure wrote.'; $passed++
foreach($hold in @('ASR','PE','MARS')) {
    Reset-Test; $fixture[$hold]=$true; $fixture.Backup=$true
    Expect-Stop {Run-TestScript -Execute} "$hold was not held."
    Assert-Test ($fixture.Writes -eq 0) "$hold hold wrote."; $passed++
}
Reset-Test; $fixture.Container=$true; $fixture.UnknownContainer=$true
Expect-Stop {Run-TestScript -Execute} 'Unknown workload accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Unknown workload wrote.'; $passed++
Reset-Test; $fixture.Backup=$true; $fixture.ExternalSource=$true
Expect-Stop {Run-TestScript -Execute} 'Target backup source accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Target source wrote.'; $passed++
Reset-Test; Run-TestScript -Execute
Assert-Test ($fixture.Deleted -and $fixture.Writes -eq 1) 'Empty-vault deletion failed.'; $passed++
Reset-Test; $fixture.Backup=$true; $fixture.Container=$true; $fixture.AutoSQL=$true; Run-TestScript -Execute
Assert-Test (($fixture.Trace -join ',') -eq 'AutoProtection,Backup,Unregister,Vault') 'Dependency order is wrong.'; $passed++
Reset-Test; $fixture.Backup=$true; $fixture.Soft=$true; Run-TestScript -Execute
Assert-Test (($fixture.Trace -join ',') -eq 'Vault') 'Rerun rewrote soft-deleted backup.'; $passed++
Reset-Test; $fixture.Backup=$true; $fixture.JobFails=$true
Expect-Stop {Run-TestScript -Execute} 'Failed job accepted.'
Assert-Test ($fixture.Writes -eq 1 -and -not $fixture.Deleted) 'Failed job did not stop later writes.'; $passed++
Reset-Test; $fixture.DeleteFails=$true
Expect-Stop {Run-TestScript -Execute} 'Retention block hidden.'
Assert-Test (-not $fixture.Deleted) 'Retention failure reported deleted.'; $passed++
Reset-Test; $fixture.Persist=$true
Expect-Stop {Run-TestScript -Execute} 'Persistent vault presence hidden.'; $passed++
Reset-Test; $fixture.ContextDrift=$true
Expect-Stop {Run-TestScript -Execute} 'Context drift accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Context drift wrote.'; $passed++
foreach($status in @(403,404,500)) {
    Reset-Test; $fixture.AsrHttp=$status
    Expect-Stop {Run-TestScript -Execute} "ASR HTTP $status accepted as empty."
    Assert-Test ($fixture.Writes -eq 0) "ASR HTTP $status wrote."; $passed++
}
foreach($bad in @('AsrBadJson','AsrBadShape','AsrUnsafeNext','AsrRepeatNext')) {
    Reset-Test; $fixture[$bad]=$true
    Expect-Stop {Run-TestScript -Execute} "$bad was accepted."
    Assert-Test ($fixture.Writes -eq 0) "$bad wrote."; $passed++
}
Reset-Test; $fixture.ASR=$true; $fixture.AsrWrongId=$true
Expect-Stop {Run-TestScript -Execute} 'Target fabric ID accepted.'
Assert-Test ($fixture.Writes -eq 0) 'Target fabric wrote.'; $passed++
Reset-Test; $fixture.AsrPaged=$true
Expect-Stop {Run-TestScript -Execute} 'ASR fabric on next page missed.'
Assert-Test ($fixture.Writes -eq 0 -and $fixture.AsrPageCalls -eq 2) 'ASR pagination failed.'; $passed++
Write-Host "PASS: $passed fully mocked Cloud Shell vault cleanup scenarios. No live Azure calls."
