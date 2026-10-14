#requires -Version 5.1
<#
.SYNOPSIS
Preview or execute an explicit legacy-subscription retirement batch.
.DESCRIPTION
David runs this script. Default mode performs Azure reads only. Execution needs
-Execute and the exact old subscription ID in -ConfirmSubscription. No login,
context switching, Terraform, Cloudflare, group deletion, or purge is performed.
The default manifest is the original compute batch. A separate approved data
manifest selects exact legacy Storage/Cosmos/SWA IDs and the storage endpoint.
An approved network manifest selects the exact legacy Award private DNS links/
zones, Service Bus namespace and VNets. Public DNS, CIAM, vaults, Network Watchers
and Azure DevOps remain excluded.
Local reports contain metadata, not secrets.
#>
[CmdletBinding()]
param(
    [switch]$Execute,
    [string]$ConfirmSubscription,
    [string]$ManifestPath = (Join-Path $PSScriptRoot 'legacy-subscription-cleanup-manifest.json'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\terraform_terianix_platform\domain-cutover-local'),
    [ValidateRange(1, 60)][int]$VerificationAttempts = 12,
    [ValidateRange(0, 60)][int]$VerificationDelaySeconds = 10
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$sourceSubscription = '4ddf12bb-5397-445f-bcaa-df4c7d3dfdca'
$expectedTenant = '5979eb86-9af1-4c74-8e50-acbe7d6a5cf9'
$sourcePrefix = "/subscriptions/$sourceSubscription/resourceGroups/"

function Get-Field {
    param($Value, [string]$Name)
    if ($null -eq $Value) { return $null }
    $property = $Value.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}

function Invoke-CleanupAz {
    param([string[]]$Arguments)
    # Capture expected 404s without terminating PowerShell 5.1 on native stderr.
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $raw = & az @Arguments --only-show-errors --output json 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    return [pscustomobject]@{
        Code = $code
        Text = (($raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
    }
}

function Get-CleanupErrorCode {
    param([string]$Text)
    $match = [regex]::Match($Text, '\(([A-Za-z][A-Za-z0-9]+)\)')
    if ($match.Success) { return $match.Groups[1].Value }
    try {
        $body = $Text | ConvertFrom-Json
        $errorObject = Get-Field $body 'error'
        $code = Get-Field $errorObject 'code'
        if ($code) { return [string]$code }
    } catch { }
    $match = [regex]::Match($Text, '(?im)^\s*(?:ERROR:\s*)?Code:\s*([A-Za-z][A-Za-z0-9]+)\s*$')
    if ($match.Success) { return $match.Groups[1].Value }
    return 'UnknownAzureError'
}

function Get-CleanupErrorSummary {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 'Azure CLI failed without captured error text.' }
    $summary = $null
    try {
        $body = ($Text -replace '^\s*ERROR:\s*', '') | ConvertFrom-Json
        $summary = Get-Field (Get-Field $body 'error') 'message'
        if (-not $summary) { $summary = Get-Field $body 'message' }
    } catch { }
    if (-not $summary) {
        $lines = @($Text -split '[\r\n]+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $messages = @($lines | Where-Object { $_ -match '^\s*(ERROR:|Message:)' })
        if ($messages.Count -gt 0) { $summary = $messages -join ' ' }
        else { $summary = $lines[-1] }
    }
    # Never persist native debug traces, credentials or query-string URLs.
    # Omit a suspect message entirely rather than partially masking a secret.
    if ($summary -match '(?i)authorization|\bbearer\b|password|secret|token|accountkey|sharedaccesssignature|connectionstring|\bsig\s*=|https?://\S+\?') {
        return 'Potentially sensitive error text omitted. Share only the error code and non-sensitive message from a direct CLI command.'
    }
    $summary = [string]$summary
    if ($summary.Length -gt 1500) { $summary = $summary.Substring(0, 1500) + ' [truncated]' }
    return $summary
}

function Read-CleanupAz {
    param([string[]]$Arguments)
    $result = Invoke-CleanupAz -Arguments $Arguments
    if ($result.Code -ne 0) {
        $code = Get-CleanupErrorCode $result.Text
        throw "Azure read failed ($code). No authentication headers are logged."
    }
    try { return ($result.Text | ConvertFrom-Json) }
    catch { throw 'Azure read did not return valid JSON. Stop and inspect the CLI login/version.' }
}

function Assert-SourceId {
    param([string]$Id)
    if ([string]::IsNullOrWhiteSpace($Id) -or
        -not $Id.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing a resource outside the fixed source subscription: $Id"
    }
}

function Read-SourceInventory {
    $items = @(Read-CleanupAz -Arguments @('resource', 'list', '--subscription',
        $sourceSubscription, '--query', '[].{id:id,name:name,type:type,resourceGroup:resourceGroup}'))
    foreach ($item in $items) {
        Assert-SourceId ([string](Get-Field $item 'id'))
        if (-not (Get-Field $item 'type')) { throw 'Inventory entry has no resource type.' }
    }
    return $items
}

function Read-ResourceId {
    param([string]$Id, [switch]$AllowInventoryLag)
    Assert-SourceId $Id
    $result = Invoke-CleanupAz -Arguments @('resource', 'show', '--subscription',
        $sourceSubscription, '--ids', $Id, '--query', '{id:id,type:type}')
    if ($result.Code -ne 0) {
        $code = Get-CleanupErrorCode $result.Text
        if ($code -in @('ResourceNotFound', 'ResourceGroupNotFound', 'ParentResourceNotFound')) {
            return $null
        }
        if ($code -eq 'NotFound') {
            # Some providers (including Managed Identity in the reported run)
            # use this generic code. Confirm the exact ID is also absent from
            # a successful fresh inventory; do not hide a bad API lookup or
            # turn permission/authentication failures into "already deleted".
            $freshInventory = @(Read-SourceInventory)
            if (@($freshInventory | Where-Object { $_.id -eq $Id }).Count -eq 0) {
                return $null
            }
            if ($AllowInventoryLag) {
                # Return evidence of continued presence, NOT proof of absence.
                # Only the post-delete waiter uses this to retry disagreement.
                return @($freshInventory | Where-Object { $_.id -eq $Id })[0]
            }
            throw "Resource lookup returned NotFound but the exact ID is still listed: $Id. Stop and investigate inconsistent metadata."
        }
        throw "Resource existence check failed ($code): $Id"
    }
    $metadata = $result.Text | ConvertFrom-Json
    if ((Get-Field $metadata 'id') -ne $Id) { throw "Resource read returned an unexpected ID: $Id" }
    return $metadata
}

function Wait-CleanupResourceAbsent {
    param([string]$Id, $Record)
    for ($attempt = 1; $attempt -le $VerificationAttempts; $attempt++) {
        $Record.verificationAttempts = $attempt
        Save-CleanupReport
        $metadata = Read-ResourceId -Id $Id -AllowInventoryLag
        if ($null -eq $metadata) {
            # Require both the exact lookup and a successful fresh inventory
            # to agree. No authorization error is interpreted as absence.
            $fresh = @(Read-SourceInventory)
            if (@($fresh | Where-Object { $_.id -eq $Id }).Count -eq 0) { return }
        }
        if ($attempt -lt $VerificationAttempts) {
            Write-Host "Waiting for deletion/inventory confirmation ($attempt/$VerificationAttempts): $Id"
            Start-Sleep -Seconds $VerificationDelaySeconds
        }
    }
    throw "Deletion is not verified after $VerificationAttempts checks: $Id. Resource lookup/inventory has not converged; stop and investigate."
}

function Get-KeepReason {
    param($Resource)
    $type = [string](Get-Field $Resource 'type')
    switch -Regex ($type) {
        '^Microsoft.DomainRegistration/' { return 'Preserve domain registration and renewal.' }
        '^Microsoft.Network/dnszones' { return 'Preserve authoritative/public DNS and mail.' }
        '^Microsoft.AzureActiveDirectory/ciamDirectories$' { return 'Preserve customer identity directory/billing linkage.' }
        '^Microsoft.Web/staticSites$' { return 'Not selected by this manifest; approved legacy SWAs have a separate disposal batch.' }
        '^Microsoft.Storage/storageAccounts$' { return 'Not selected by this manifest; approved legacy storage has a separate disposal batch.' }
        '^Microsoft.DocumentDB/' { return 'Not selected by this manifest; approved legacy Cosmos has a separate disposal batch.' }
        '^Microsoft.ServiceBus/' { return 'Not selected by this manifest; the approved legacy Award namespace has a separate retirement batch.' }
        '^Microsoft.RecoveryServices/' { return 'Hold vault contents/retention review.' }
        '^microsoft.visualstudio/' { return 'Hold Azure DevOps ownership review.' }
        '^Microsoft.Network/(networkInterfaces|publicIPAddresses|loadBalancers)$' { return 'Managed/dependent networking; parent lifecycle first, no direct deletion.' }
        '^Microsoft.Network/(virtualNetworks|privateDnsZones)' { return 'Not selected by this manifest; reviewed legacy Award networking has a separate retirement batch.' }
        default { return 'Not on the exact reviewed deletion allowlist; preserve for separate review.' }
    }
}

if ($Execute -and $ConfirmSubscription -cne $sourceSubscription) {
    throw "Execution requires -ConfirmSubscription $sourceSubscription. No Azure operations were attempted."
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.sourceSubscriptionId -ne $sourceSubscription -or
    $manifest.tenantId -ne $expectedTenant) { throw 'Manifest subscription, tenant or schema does not match the fixed source.' }
$approvedTypes = @(
    'Microsoft.App/jobs', 'Microsoft.App/containerApps', 'Microsoft.App/managedEnvironments',
    'Microsoft.Logic/workflows', 'Microsoft.Cdn/profiles',
    'Microsoft.Network/frontdoorWebApplicationFirewallPolicies', 'Microsoft.Network/privateEndpoints',
    'Microsoft.CognitiveServices/accounts', 'Microsoft.ContainerRegistry/registries',
    'Microsoft.KeyVault/vaults', 'Microsoft.ManagedIdentity/userAssignedIdentities',
    'microsoft.alertsmanagement/smartDetectorAlertRules', 'microsoft.insights/actiongroups',
    'Microsoft.Portal/dashboards', 'microsoft.insights/workbooks', 'Microsoft.Dashboard/dashboards',
    'Microsoft.Insights/components', 'microsoft.monitor/accounts', 'Microsoft.OperationalInsights/workspaces',
    'Microsoft.Web/staticSites', 'Microsoft.Storage/storageAccounts', 'Microsoft.DocumentDB/databaseAccounts',
    'Microsoft.Network/privateDnsZones', 'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    'Microsoft.Network/virtualNetworks', 'Microsoft.ServiceBus/namespaces'
)
$approvedGroups = @('rg_award_nomination_sandbox', 'rg_corporate', 'rg_awards_dashboard')
# New destructive types are pinned to the exact eight IDs David approved.
# Adding a type to the list above must not authorize arbitrary data accounts.
$approvedDisposalIds = @(
    "${sourcePrefix}rg_platform/providers/Microsoft.Web/staticSites/terian-services-frontend",
    "${sourcePrefix}rg_corporate/providers/Microsoft.Web/staticSites/terianix-frontend",
    "${sourcePrefix}rg_award_nomination_sandbox/providers/Microsoft.Web/staticSites/award-nomination-frontend-sandbox",
    "${sourcePrefix}rg_corporate/providers/Microsoft.DocumentDB/databaseAccounts/terian-services-cosmos-db",
    "${sourcePrefix}rg_corporate/providers/Microsoft.Storage/storageAccounts/stterianservices",
    "${sourcePrefix}rg_platform/providers/Microsoft.Storage/storageAccounts/awardnomplatform",
    "${sourcePrefix}rg_award_nomination_sandbox/providers/Microsoft.Storage/storageAccounts/stawardnomssandbox",
    "${sourcePrefix}AZ-305/providers/Microsoft.Storage/storageAccounts/az305storage1964"
)
$disposalTypes = @('Microsoft.Web/staticSites', 'Microsoft.Storage/storageAccounts', 'Microsoft.DocumentDB/databaseAccounts')
$storageEndpointId = "${sourcePrefix}rg_award_nomination_sandbox/providers/Microsoft.Network/privateEndpoints/pe-stawardnomssandbox"
$storageAccountId = "${sourcePrefix}rg_award_nomination_sandbox/providers/Microsoft.Storage/storageAccounts/stawardnomssandbox"
$networkPrefix = "${sourcePrefix}rg_award_nomination_sandbox/providers/"
$networkTypes = @('Microsoft.Network/privateDnsZones', 'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    'Microsoft.Network/virtualNetworks', 'Microsoft.ServiceBus/namespaces')
$approvedNetwork = @{}
$reviewedVnetIds = @(
    "${networkPrefix}Microsoft.Network/virtualNetworks/vnet-award-primary-sandbox",
    "${networkPrefix}Microsoft.Network/virtualNetworks/vnet-award-secondary-sandbox"
)
foreach ($vnetId in $reviewedVnetIds) {
    $approvedNetwork[$vnetId] = @{ type = 'Microsoft.Network/virtualNetworks'; order = 130 }
}
$approvedNetwork["${networkPrefix}Microsoft.ServiceBus/namespaces/sb-award-sandbox"] = @{ type = 'Microsoft.ServiceBus/namespaces'; order = 100 }
foreach ($zoneSpec in @(
    @{ zone = 'privatelink.database.windows.net'; tag = 'sql' },
    @{ zone = 'privatelink.openai.azure.com'; tag = 'openai' },
    @{ zone = 'privatelink.vaultcore.azure.net'; tag = 'kv' },
    @{ zone = 'privatelink.azurecr.io'; tag = 'acr' },
    @{ zone = 'privatelink.blob.core.windows.net'; tag = 'blob' }
)) {
    $zoneId = "${networkPrefix}Microsoft.Network/privateDnsZones/$($zoneSpec.zone)"
    $approvedNetwork[$zoneId] = @{ type = 'Microsoft.Network/privateDnsZones'; order = 120 }
    foreach ($side in @('primary', 'secondary')) {
        $linkId = "$zoneId/virtualNetworkLinks/link-$($zoneSpec.tag)-$side-sandbox"
        $approvedNetwork[$linkId] = @{
            type = 'Microsoft.Network/privateDnsZones/virtualNetworkLinks'; order = 110
            expectedZoneId = $zoneId
            expectedVirtualNetworkId = "${networkPrefix}Microsoft.Network/virtualNetworks/vnet-award-$side-sandbox"
        }
    }
}
$manifestById = @{}
foreach ($entry in @($manifest.resources)) {
    Assert-SourceId ([string]$entry.id)
    if ($entry.type -notin $approvedTypes) { throw "Protected/unapproved resource type in manifest: $($entry.type)" }
    $tail = $entry.id.Substring($sourcePrefix.Length)
    $group = $tail.Split('/')[0]
    $expectedPrefix = "$sourcePrefix$group/providers/$($entry.type)/"
    $isNetwork = $entry.type -in $networkTypes
    if ($isNetwork) {
        if ((Get-Field $manifest 'legacyNetworkDisposalApproved') -ne $true -or
            -not $approvedNetwork.ContainsKey($entry.id)) {
            throw 'Network/messaging disposal requires an approved manifest and exact reviewed ID.'
        }
        $networkSpec = $approvedNetwork[$entry.id]
        if ($entry.type -ne $networkSpec.type -or [int]$entry.order -ne $networkSpec.order) {
            throw 'Network resource type/order differs from the fixed dependency order.'
        }
        if ($entry.type -eq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and
            ((Get-Field $entry 'expectedZoneId') -ne $networkSpec.expectedZoneId -or
             (Get-Field $entry 'expectedVirtualNetworkId') -ne $networkSpec.expectedVirtualNetworkId)) {
            throw 'DNS link parent/target differs from the reviewed legacy source IDs.'
        }
    }
    $isDisposal = $entry.type -in $disposalTypes
    if ($isDisposal -and ($entry.id -notin $approvedDisposalIds -or
        (Get-Field $manifest 'legacyDataDisposalApproved') -ne $true)) {
        throw 'Data/SWA disposal requires the approved exact ID and explicit disposal manifest.'
    }
    if ($entry.type -ne 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and
        (($group -notin $approvedGroups -and -not $isDisposal) -or
        -not $entry.id.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        [string]::IsNullOrWhiteSpace($entry.id.Substring($expectedPrefix.Length)) -or
        $entry.id.Substring($expectedPrefix.Length).Contains('/') -or [int]$entry.order -le 0)) {
        throw "Invalid resource identity/order in manifest: $($entry.id)"
    }
    if ($manifestById.ContainsKey($entry.id)) { throw 'Duplicate resource ID in manifest.' }
    if ($entry.type -eq 'Microsoft.Network/privateEndpoints') {
        $connectionId = [string](Get-Field $entry 'expectedConnectionId')
        Assert-SourceId $connectionId
        if (-not $connectionId.StartsWith("$sourcePrefix$group/providers/", [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Private endpoint connection is not in its reviewed source group.'
        }
        if ($entry.id -eq $storageEndpointId -and ($connectionId -ne $storageAccountId -or
            (Get-Field $manifest 'legacyDataDisposalApproved') -ne $true)) {
            throw 'Storage endpoint requires its approved storage disposal manifest and exact connection.'
        }
    }
    $manifestById[$entry.id] = $entry
}
$isDisposalBatch = @($manifest.resources | Where-Object { $_.type -in $disposalTypes }).Count -gt 0
$isNetworkBatch = @($manifest.resources | Where-Object { $_.type -in $networkTypes }).Count -gt 0
foreach ($link in @($manifest.resources | Where-Object { $_.type -eq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' })) {
    if (-not $manifestById.ContainsKey($link.expectedZoneId)) {
        throw 'DNS link requires its reviewed parent zone in the same batch.'
    }
}

function Assert-NetworkInventory {
    param([object[]]$Items)
    $unreviewed = @($Items | Where-Object {
        $_.id.StartsWith($networkPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        $_.type -in $networkTypes -and -not $manifestById.ContainsKey($_.id)
    })
    if ($unreviewed.Count -gt 0) { throw 'Unreviewed legacy Award network/messaging resources exist. Stop and refresh the exact manifest.' }
    if (@($Items | Where-Object { $_.type -eq 'Microsoft.Network/privateEndpoints' }).Count -gt 0) {
        throw 'Source private endpoints remain or were recreated. Stop before network retirement.'
    }
    if (@($Items | Where-Object {
        $_.id.StartsWith($networkPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        $_.type -in @('Microsoft.Storage/storageAccounts', 'Microsoft.DocumentDB/databaseAccounts', 'Microsoft.Sql/servers')
    }).Count -gt 0) { throw 'Legacy Award data services remain or were recreated. Finish their retirement before networking.' }
}

function Read-ReviewedZoneLinks {
    param($Zone, [switch]$RequireEmpty)
    $links = @(Read-CleanupAz -Arguments @('network', 'private-dns', 'link', 'vnet', 'list',
        '--subscription', $sourceSubscription, '--resource-group', 'rg_award_nomination_sandbox',
        '--zone-name', $Zone.id.Split('/')[-1], '--query', '[].{id:id,virtualNetworkId:virtualNetwork.id}', '--top', '1000'))
    if ($links.Count -ge 1000) { throw 'DNS link listing may be truncated. Stop before deletion.' }
    foreach ($link in $links) {
        Assert-SourceId ([string](Get-Field $link 'id'))
        if (-not $manifestById.ContainsKey($link.id) -or
            $manifestById[$link.id].type -ne 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -or
            $manifestById[$link.id].expectedZoneId -ne $Zone.id -or
            $manifestById[$link.id].expectedVirtualNetworkId -ne (Get-Field $link 'virtualNetworkId')) {
            throw "DNS zone has an unreviewed or cross-subscription VNet link: $($Zone.id)"
        }
    }
    if ($RequireEmpty -and $links.Count -gt 0) { throw "DNS links remain or were recreated before zone deletion: $($Zone.id)" }
    return $links
}

function Assert-ReviewedVnetUnattached {
    param($Entry)
    $metadata = Read-CleanupAz -Arguments @('resource', 'show', '--subscription',
        $sourceSubscription, '--ids', $Entry.id, '--query',
        '{id:id,peerings:properties.virtualNetworkPeerings[].properties.remoteVirtualNetwork.id,ipConfigurations:properties.subnets[].properties.ipConfigurations[].id,privateEndpoints:properties.subnets[].properties.privateEndpoints[].id,serviceAssociations:properties.subnets[].properties.serviceAssociationLinks[].id,navigationLinks:properties.subnets[].properties.resourceNavigationLinks[].id}')
    if ($metadata.id -ne $Entry.id) { throw 'VNet metadata returned a different resource ID.' }
    foreach ($field in @('peerings', 'ipConfigurations', 'privateEndpoints', 'serviceAssociations', 'navigationLinks')) {
        if ($null -eq $metadata.PSObject.Properties[$field]) { throw 'VNet dependency metadata is incomplete. Stop before deletion.' }
    }
    foreach ($field in @('ipConfigurations', 'privateEndpoints', 'serviceAssociations', 'navigationLinks')) {
        if (@((Get-Field $metadata $field) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }).Count -gt 0) {
            throw "VNet has remaining subnet attachments ($field): $($Entry.id)"
        }
    }
    foreach ($peer in @((Get-Field $metadata 'peerings') | Where-Object { $_ })) {
        if ($peer -notin $reviewedVnetIds -or -not $manifestById.ContainsKey($peer)) {
            throw "VNet peering references an unreviewed/target VNet: $($Entry.id)"
        }
    }
}
if ($manifestById.ContainsKey($storageAccountId) -and
    (-not $manifestById.ContainsKey($storageEndpointId) -or
     [int]$manifestById[$storageEndpointId].order -ge [int]$manifestById[$storageAccountId].order)) {
    throw 'Award storage disposal requires its endpoint earlier in the same manifest.'
}

Get-Command az -ErrorAction Stop | Out-Null
$account = Read-CleanupAz -Arguments @('account', 'show', '--subscription',
    $sourceSubscription, '--query', '{id:id,tenantId:tenantId,user:user.name}')
if ($account.id -ne $sourceSubscription -or $account.tenantId -ne $expectedTenant) {
    throw "Sign into Terianix Platform tenant $expectedTenant with source subscription access."
}
$inventory = @(Read-SourceInventory)
$existingById = @{}
foreach ($resource in $inventory) {
    if ($existingById.ContainsKey($resource.id)) { throw 'Duplicate resource ID in Azure inventory.' }
    $existingById[$resource.id] = $resource
}
$plan = @($manifest.resources | Where-Object { $existingById.ContainsKey($_.id) } | Sort-Object order, id)
foreach ($entry in $plan) {
    if ($existingById[$entry.id].type -ne $entry.type) { throw "Resource type mismatch: $($entry.id)" }
}

# Unknown source consumers could use a registry, secret, environment or model
# scheduled for removal. Do not silently extend the allowlist or delete around them.
$unexpectedConsumers = @($inventory | Where-Object {
    $_.type -in @('Microsoft.App/containerApps', 'Microsoft.App/jobs', 'Microsoft.Logic/workflows') -and
    -not $manifestById.ContainsKey($_.id)
})
if ($unexpectedConsumers.Count -gt 0) {
    throw 'Unreviewed source apps/jobs/Logic Apps exist. Refresh the allowlist before execution.'
}
if ($isNetworkBatch) {
    Assert-NetworkInventory -Items $inventory
    foreach ($zone in @($plan | Where-Object { $_.type -eq 'Microsoft.Network/privateDnsZones' })) {
        $listedLinks = @(Read-ReviewedZoneLinks -Zone $zone)
        foreach ($link in $listedLinks) {
            if (-not $existingById.ContainsKey($link.id)) { throw 'DNS link listing and source inventory disagree. Stop before writes.' }
        }
    }
    foreach ($vnet in @($plan | Where-Object { $_.type -eq 'Microsoft.Network/virtualNetworks' })) {
        Assert-ReviewedVnetUnattached -Entry $vnet
    }
}
if ($isDisposalBatch -and @($inventory | Where-Object {
    $_.type -eq 'Microsoft.Network/privateEndpoints' -and -not $manifestById.ContainsKey($_.id)
}).Count -gt 0) {
    throw 'Unreviewed source private endpoint remains. Stop before data disposal.'
}

# Check ALL endpoint mappings before the first write; a name is not proof of its target.
foreach ($entry in @($plan | Where-Object { $_.type -eq 'Microsoft.Network/privateEndpoints' })) {
    $links = Read-CleanupAz -Arguments @('resource', 'show', '--subscription',
        $sourceSubscription, '--ids', $entry.id, '--query',
        '{id:id,connections:properties.privateLinkServiceConnections[].properties.privateLinkServiceId,manualConnections:properties.manualPrivateLinkServiceConnections[].properties.privateLinkServiceId}')
    if ($links.id -ne $entry.id) { throw 'Private endpoint read returned a different resource ID.' }
    $targets = @(@(Get-Field $links 'connections') + @(Get-Field $links 'manualConnections') |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($targets.Count -eq 0 -or @($targets | Where-Object { $_ -ne $entry.expectedConnectionId }).Count -gt 0) {
        throw "Private endpoint has a missing/unexpected connection target: $($entry.id)"
    }
}

$kept = @($inventory | Where-Object { -not $manifestById.ContainsKey($_.id) } | ForEach-Object {
    [pscustomobject]@{ id = $_.id; type = $_.type; reason = Get-KeepReason $_ }
})
$report = [ordered]@{
    schemaVersion = 1; mode = $(if ($Execute) { 'Execute' } else { 'Preview' })
    startedUtc = [DateTime]::UtcNow.ToString('o'); finishedUtc = $null
    subscriptionId = $sourceSubscription; tenantId = $expectedTenant
    manifestSha256 = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash
    legacyDataDisposalApproved = ((Get-Field $manifest 'legacyDataDisposalApproved') -eq $true)
    legacyNetworkDisposalApproved = ((Get-Field $manifest 'legacyNetworkDisposalApproved') -eq $true)
    verificationAttempts = $VerificationAttempts; verificationDelaySeconds = $VerificationDelaySeconds
    status = 'Preview'; inventoryEntries = $inventory.Count
    planned = @($plan | ForEach-Object { [pscustomobject]@{ id = $_.id; type = $_.type; order = $_.order } })
    absentAllowlistIds = @($manifest.resources | Where-Object { -not $existingById.ContainsKey($_.id) } | ForEach-Object { $_.id })
    kept = $kept; execution = @(); finalSourceIds = @(); error = $null
}
$runName = "legacy-subscription-cleanup-{0}-{1}" -f [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'), [Guid]::NewGuid().ToString('N').Substring(0, 8)
$runDirectory = Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) $runName
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$reportPath = Join-Path $runDirectory 'report.json'
function Save-CleanupReport {
    [IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 15), (New-Object Text.UTF8Encoding($false)))
}

Write-Host "Fixed source subscription: $sourceSubscription"
Write-Host "Planned explicit deletes: $($plan.Count); retained entries: $($kept.Count)"
if ($isDisposalBatch) {
    Write-Host 'APPROVED LEGACY DISPOSAL: source data, state, storage queues and source frontend bindings will be removed. No backups or DNS repairs are performed.'
}
if ($isNetworkBatch) { Write-Host 'APPROVED LEGACY NETWORK RETIREMENT: Service Bus messages/entities, private DNS records/links and both reviewed VNets will be deleted. Public DNS and target resources are excluded.' }
foreach ($entry in $plan) { Write-Host "DELETE [$($entry.order)] $($entry.id)" }
foreach ($resource in $kept) { Write-Host "KEEP $($resource.id) -- $($resource.reason)" }
Save-CleanupReport
Write-Host "Local metadata report: $reportPath"
if (-not $Execute) {
    Write-Host 'PREVIEW ONLY: no Azure settings/resources were changed.'
    Write-Host "After review, execute with -Execute -ConfirmSubscription $sourceSubscription."
    return
}

$report.status = 'Executing'
Save-CleanupReport
try {
    foreach ($entry in $plan) {
        # Require all original apps/jobs to be gone before touching shared
        # infrastructure. Also stop on any concurrently-created source consumers.
        if ([int]$entry.order -ge 30) {
            $current = @(Read-SourceInventory)
            $remainingConsumers = @($current | Where-Object {
                $_.type -in @('Microsoft.App/containerApps', 'Microsoft.App/jobs', 'Microsoft.Logic/workflows')
            })
            if ($remainingConsumers.Count -gt 0) {
                throw 'Source consumers remain or were recreated. Stop before shared infrastructure deletion.'
            }
            if ($isNetworkBatch) { Assert-NetworkInventory -Items $current }
            if ($entry.type -eq 'Microsoft.Storage/storageAccounts' -and
                @($current | Where-Object { $_.type -eq 'Microsoft.Network/privateEndpoints' }).Count -gt 0) {
                throw 'Source private endpoints remain or were recreated. Stop before storage deletion.'
            }
        }
        $record = [pscustomobject]@{ id = $entry.id; status = 'Checking'; errorCode = $null; errorSummary = $null; deleteExitCode = $null; deleteCommandSucceeded = $false; verificationAttempts = 0 }
        $report.execution += $record
        Save-CleanupReport
        if ($null -eq (Read-ResourceId $entry.id)) {
            $record.status = 'AlreadyAbsent'
            Save-CleanupReport
            continue
        }
        if ($isNetworkBatch -and $entry.type -eq 'Microsoft.Network/privateDnsZones') {
            Read-ReviewedZoneLinks -Zone $entry -RequireEmpty | Out-Null
        }
        if ($isNetworkBatch -and $entry.type -eq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks') {
            $linkMetadata = Read-CleanupAz -Arguments @('resource', 'show', '--subscription',
                $sourceSubscription, '--ids', $entry.id, '--query', '{id:id,virtualNetworkId:properties.virtualNetwork.id}')
            if ($linkMetadata.id -ne $entry.id -or $linkMetadata.virtualNetworkId -ne $entry.expectedVirtualNetworkId) {
                throw 'DNS link target changed before deletion. Stop without removing that link.'
            }
        }
        if ($isNetworkBatch -and $entry.type -eq 'Microsoft.Network/virtualNetworks') {
            Assert-ReviewedVnetUnattached -Entry $entry
        }
        $record.status = 'Deleting'
        Save-CleanupReport
        Write-Host "Deleting $($entry.id)"
        $result = Invoke-CleanupAz -Arguments @('resource', 'delete', '--subscription',
            $sourceSubscription, '--ids', $entry.id)
        $record.deleteExitCode = $result.Code
        if ($result.Code -ne 0) {
            $record.errorCode = Get-CleanupErrorCode $result.Text
            $record.errorSummary = Get-CleanupErrorSummary $result.Text
            $record.status = 'Failed'
            throw "Delete failed ($($record.errorCode), CLI exit $($record.deleteExitCode)): $($entry.id). $($record.errorSummary) Stop; no locks/purges are automated."
        }
        $record.deleteCommandSucceeded = $true
        $record.status = 'Verifying'
        Save-CleanupReport
        try { Wait-CleanupResourceAbsent -Id $entry.id -Record $record }
        catch {
            $record.status = 'VerificationFailed'
            throw
        }
        $record.status = 'DeletedAndVerifiedAbsent'
        Save-CleanupReport
    }
    for ($attempt = 1; $attempt -le $VerificationAttempts; $attempt++) {
        $final = @(Read-SourceInventory)
        $report.finalSourceIds = @($final | ForEach-Object { $_.id })
        Save-CleanupReport
        if (@($final | Where-Object { $manifestById.ContainsKey($_.id) }).Count -eq 0) { break }
        if ($attempt -lt $VerificationAttempts) {
            Write-Host "Waiting for final inventory confirmation ($attempt/$VerificationAttempts)."
            Start-Sleep -Seconds $VerificationDelaySeconds
        }
    }
    if (@($final | Where-Object { $manifestById.ContainsKey($_.id) }).Count -gt 0) {
        throw 'An allowlisted resource is still listed after execution. Do not report the batch complete.'
    }
    $report.status = 'Completed'
    $report.finishedUtc = [DateTime]::UtcNow.ToString('o')
    Save-CleanupReport
    Write-Host 'Batch complete: every explicit deletion target was verified absent.'
    Write-Host 'Protected/held resources remain. This is NOT whole-subscription retirement.'
} catch {
    $report.status = 'Stopped'
    $report.error = $_.Exception.Message
    $report.finishedUtc = [DateTime]::UtcNow.ToString('o')
    Save-CleanupReport
    Write-Host "STOPPED. Some earlier deletes may have completed. Review $reportPath before rerunning."
    throw
}
