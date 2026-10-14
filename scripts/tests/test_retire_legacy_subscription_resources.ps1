#requires -Version 5.1
# Every az call is a local function mock. No Azure/network operations occur.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$scriptPath = Join-Path $PSScriptRoot '..\retire-legacy-subscription-resources.ps1'
$manifestPath = Join-Path $PSScriptRoot '..\legacy-subscription-cleanup-manifest.json'
$testManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$sourceId = '4ddf12bb-5397-445f-bcaa-df4c7d3dfdca'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('legacy-subscription-cleanup-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Reset-TestState {
    $fixture = @($testManifest.resources | ForEach-Object {
        [pscustomobject]@{ id = $_.id; type = $_.type; name = $_.id.Split('/')[-1]; resourceGroup = $_.id.Split('/')[4] }
    })
    foreach ($held in @(
        'Microsoft.DomainRegistration/domains/terian-services.com',
        'Microsoft.Network/dnszones/terian-services.com',
        'Microsoft.AzureActiveDirectory/ciamDirectories/customer.onmicrosoft.com',
        'Microsoft.Web/staticSites/terian-services-frontend',
        'Microsoft.Storage/storageAccounts/awardnomplatform',
        'Microsoft.DocumentDB/databaseAccounts/source-cosmos',
        'Microsoft.ServiceBus/namespaces/source-queue'
    )) {
        $segments = $held.Split('/')
        $heldId = "/subscriptions/$sourceId/resourceGroups/rg_platform/providers/$held"
        if (@($fixture | Where-Object { $_.id -eq $heldId }).Count -eq 0) {
            $fixture += [pscustomobject]@{
                id = $heldId
                type = "$($segments[0])/$($segments[1])"; name = $segments[-1]; resourceGroup = 'rg_platform'
            }
        }
    }
    $global:cleanupTest = [pscustomobject]@{
        resources = $fixture; calls = @(); deleteAttempts = 0; deletedIds = @()
        wrongTenant = $false; foreignInventory = $false; typeMismatch = $false
        wrongEndpoint = $false; unknownConsumer = $false; malformedRead = $false
        failDeleteAt = 0; denyVerify = $false; injectConsumer = $false
        failureText = '(ScopeLocked) Synthetic protected resource'
        missingCode = 'ResourceNotFound'; falseNotFoundId = $null; vanishBeforeShowId = $null
        injectEndpoint = $false
        sleeps = 0; lagListsRemaining = 0; lagResource = $null; showLagRemaining = 0
        retainDeletedResource = $false; denyInventoryAfterDelete = $false
        finalLagRemaining = 0; completedInventoryReads = 0
        networkFailure = ''; recreateKnownLink = $false
    }
}

# Retry tests are deterministic and never actually sleep.
function global:Start-Sleep {
    param([int]$Seconds)
    Assert-True ($Seconds -ge 0 -and $Seconds -le 60) 'Unexpected retry delay.'
    $global:cleanupTest.sleeps++
}

function global:az {
    $cli = @($args)
    $global:cleanupTest.calls += ,$cli
    $global:LASTEXITCODE = 0
    $subIndex = [Array]::IndexOf($cli, '--subscription')
    Assert-True ($subIndex -ge 0 -and $cli[$subIndex + 1] -eq $sourceId) 'CLI call did not explicitly select source.'
    $command = "$($cli[0]) $($cli[1])"
    if ($global:cleanupTest.malformedRead) { return '{invalid-json' }
    if ($command -eq 'account show') {
        $tenant = '5979eb86-9af1-4c74-8e50-acbe7d6a5cf9'
        if ($global:cleanupTest.wrongTenant) { $tenant = 'original-tenant' }
        return (@{ id = $sourceId; tenantId = $tenant; user = 'synthetic-admin@example.test' } | ConvertTo-Json)
    }
    if ($command -eq 'network private-dns') {
        Assert-True ($cli[2] -eq 'link' -and $cli[3] -eq 'vnet' -and $cli[4] -eq 'list') 'Unapproved mocked private DNS operation.'
        $zoneIndex = [Array]::IndexOf($cli, '--zone-name')
        $zoneName = $cli[$zoneIndex + 1]
        $linkSpecs = @($testManifest.resources | Where-Object { $_.type -eq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and $_.expectedZoneId.EndsWith("/$zoneName") })
        $rows = @($linkSpecs | Where-Object { $_.id -in $global:cleanupTest.resources.id } | ForEach-Object {
            [pscustomobject]@{ id = $_.id; virtualNetworkId = $_.expectedVirtualNetworkId }
        })
        if ($rows.Count -gt 0 -and $global:cleanupTest.networkFailure -eq 'targetLink') {
            $rows[0].virtualNetworkId = $rows[0].virtualNetworkId.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667')
        }
        if ($rows.Count -gt 0 -and $global:cleanupTest.networkFailure -eq 'foreignLinkId') {
            $rows[0].id = $rows[0].id.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667')
        }
        if ($rows.Count -gt 0 -and $global:cleanupTest.networkFailure -eq 'missingLinkTarget') {
            $rows[0].virtualNetworkId = $null
        }
        if ($global:cleanupTest.networkFailure -eq 'unlistedLink') {
            $rows += [pscustomobject]@{ id = $linkSpecs[0].expectedZoneId + '/virtualNetworkLinks/unreviewed'; virtualNetworkId = $linkSpecs[0].expectedVirtualNetworkId }
        }
        if ($global:cleanupTest.recreateKnownLink -and $global:cleanupTest.deleteAttempts -ge 11) {
            $rows += [pscustomobject]@{ id = $linkSpecs[0].id; virtualNetworkId = $linkSpecs[0].expectedVirtualNetworkId }
        }
        return (ConvertTo-Json -InputObject $rows -Depth 10)
    }
    if ($command -eq 'resource list') {
        if ($global:cleanupTest.denyInventoryAfterDelete -and $global:cleanupTest.deleteAttempts -gt 0) {
            $global:LASTEXITCODE = 1
            return '(AuthorizationFailed) Synthetic inventory verification failure'
        }
        $items = @($global:cleanupTest.resources)
        if ($null -ne $global:cleanupTest.lagResource -and $global:cleanupTest.lagListsRemaining -gt 0) {
            $items += $global:cleanupTest.lagResource
            $global:cleanupTest.lagListsRemaining--
        }
        if ($global:cleanupTest.deletedIds.Count -eq $testManifest.resources.Count) {
            $global:cleanupTest.completedInventoryReads++
            if ($global:cleanupTest.completedInventoryReads -gt 1 -and $global:cleanupTest.finalLagRemaining -gt 0) {
                $items += [pscustomobject]@{ id = $testManifest.resources[0].id; type = $testManifest.resources[0].type; name = 'stale'; resourceGroup = 'rg_platform' }
                $global:cleanupTest.finalLagRemaining--
            }
        }
        if ($global:cleanupTest.foreignInventory) {
            $items += @{ id = '/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/target/providers/Microsoft.App/containerApps/new'; type = 'Microsoft.App/containerApps' }
        }
        if ($global:cleanupTest.unknownConsumer -or ($global:cleanupTest.injectConsumer -and $global:cleanupTest.deleteAttempts -gt 0)) {
            $items += @{ id = "/subscriptions/$sourceId/resourceGroups/rg_corporate/providers/Microsoft.App/containerApps/unreviewed"; type = 'Microsoft.App/containerApps'; name = 'unreviewed'; resourceGroup = 'rg_corporate' }
        }
        if ($global:cleanupTest.typeMismatch) {
            $items = @($items | ForEach-Object {
                if ($_.id -eq $testManifest.resources[0].id) {
                    @{ id = $_.id; type = 'Microsoft.Storage/storageAccounts'; name = 'wrong-type'; resourceGroup = 'rg_award_nomination_sandbox' }
                } else { $_ }
            })
        }
        if ($global:cleanupTest.injectEndpoint -and $global:cleanupTest.deleteAttempts -gt 0) {
            $items += @{ id = "/subscriptions/$sourceId/resourceGroups/rg_corporate/providers/Microsoft.Network/privateEndpoints/recreated"; type = 'Microsoft.Network/privateEndpoints'; name = 'recreated'; resourceGroup = 'rg_corporate' }
        }
        return (ConvertTo-Json -InputObject $items -Depth 10)
    }
    $idIndex = [Array]::IndexOf($cli, '--ids')
    Assert-True ($idIndex -ge 0) 'Missing exact resource ID.'
    $id = $cli[$idIndex + 1]
    $match = @($global:cleanupTest.resources | Where-Object { $_.id -eq $id })
    if ($command -eq 'resource show') {
        if ($global:cleanupTest.denyVerify -and $id -in $global:cleanupTest.deletedIds) {
            $global:LASTEXITCODE = 1
            return '(AuthorizationFailed) Synthetic verification failure'
        }
        if ($null -ne $global:cleanupTest.lagResource -and $id -eq $global:cleanupTest.lagResource.id -and
            $global:cleanupTest.showLagRemaining -gt 0) {
            $global:cleanupTest.showLagRemaining--
            return (@{ id = $id; type = $global:cleanupTest.lagResource.type } | ConvertTo-Json)
        }
        if ($match.Count -eq 0) {
            $global:LASTEXITCODE = 1
            return "($($global:cleanupTest.missingCode)) Synthetic absent resource"
        }
        if ($id -eq $global:cleanupTest.falseNotFoundId) {
            $global:LASTEXITCODE = 1
            return '(NotFound) Synthetic failed lookup of a still-listed resource'
        }
        if ($id -eq $global:cleanupTest.vanishBeforeShowId) {
            $global:cleanupTest.resources = @($global:cleanupTest.resources | Where-Object { $_.id -ne $id })
            $global:LASTEXITCODE = 1
            return '(NotFound) Synthetic resource disappeared after initial inventory'
        }
        $queryIndex = [Array]::IndexOf($cli, '--query')
        if ($queryIndex -ge 0 -and $cli[$queryIndex + 1] -match 'virtualNetworkId:') {
            $spec = @($testManifest.resources | Where-Object { $_.id -eq $id })[0]
            $vnetTarget = $spec.expectedVirtualNetworkId
            if ($global:cleanupTest.networkFailure -eq 'changedLinkTarget' -and $global:cleanupTest.deleteAttempts -gt 0) {
                $vnetTarget = $vnetTarget.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667')
            }
            return (@{ id = $id; virtualNetworkId = $vnetTarget } | ConvertTo-Json)
        }
        if ($queryIndex -ge 0 -and $cli[$queryIndex + 1] -match 'peerings:') {
            $vnetMetadata = @{ id = $id; peerings = @(); ipConfigurations = @(); privateEndpoints = @(); serviceAssociations = @(); navigationLinks = @() }
            switch ($global:cleanupTest.networkFailure) {
                'targetPeering' { $vnetMetadata.peerings = @($id.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667')) }
                'sourcePeering' { $vnetMetadata.peerings = @($testManifest.resources | Where-Object { $_.type -eq 'Microsoft.Network/virtualNetworks' -and $_.id -ne $id } | ForEach-Object { $_.id }) }
                'ipConfiguration' { $vnetMetadata.ipConfigurations = @($id + '/subnets/subnet/ipConfigurations/active') }
                'subnetEndpoint' { $vnetMetadata.privateEndpoints = @($id + '/subnets/subnet/privateEndpoints/active') }
                'serviceAssociation' { $vnetMetadata.serviceAssociations = @($id + '/subnets/subnet/serviceAssociationLinks/active') }
                'navigationLink' { $vnetMetadata.navigationLinks = @($id + '/subnets/subnet/resourceNavigationLinks/active') }
                'missingVnetMetadata' { $vnetMetadata.Remove('peerings') }
            }
            return ($vnetMetadata | ConvertTo-Json -Depth 10)
        }
        if ($queryIndex -ge 0 -and $cli[$queryIndex + 1] -match 'connections:') {
            $spec = @($testManifest.resources | Where-Object { $_.id -eq $id })[0]
            $target = $spec.expectedConnectionId
            if ($global:cleanupTest.wrongEndpoint) {
                $target = '/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/target/providers/Microsoft.Sql/servers/new'
            }
            return (@{ id = $id; connections = @($target); manualConnections = @() } | ConvertTo-Json)
        }
        return (@{ id = $id; type = $match[0].type } | ConvertTo-Json)
    }
    if ($command -eq 'resource delete') {
        Assert-True (@($testManifest.resources | Where-Object { $_.id -eq $id }).Count -eq 1) 'Delete outside allowlist.'
        $global:cleanupTest.deleteAttempts++
        if ($global:cleanupTest.failDeleteAt -eq $global:cleanupTest.deleteAttempts) {
            $global:LASTEXITCODE = 1
            return $global:cleanupTest.failureText
        }
        $global:cleanupTest.deletedIds += $id
        if ($global:cleanupTest.deleteAttempts -eq 1 -and
            ($global:cleanupTest.lagListsRemaining -gt 0 -or $global:cleanupTest.showLagRemaining -gt 0)) {
            $global:cleanupTest.lagResource = $match[0]
        }
        if (-not $global:cleanupTest.retainDeletedResource) {
            $global:cleanupTest.resources = @($global:cleanupTest.resources | Where-Object {
                $_.id -ne $id -and -not $_.id.StartsWith("$id/", [StringComparison]::OrdinalIgnoreCase)
            })
        }
        return
    }
    throw "Unapproved mocked operation: $command"
}

function Expect-Failure {
    param([scriptblock]$Action, [string]$Label)
    $failed = $false
    try { & $Action } catch { $failed = $true }
    Assert-True $failed "Expected failure: $Label"
}

Reset-TestState
& $scriptPath -OutputDirectory (Join-Path $testRoot 'preview')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Preview issued a delete.'
$preview = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'preview') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($preview.planned.Count -eq 51 -and $preview.kept.Count -eq 7) 'Preview misclassified resources.'

Reset-TestState
Expect-Failure { & $scriptPath -Execute -OutputDirectory $testRoot } 'missing explicit confirmation'
Assert-True ($global:cleanupTest.calls.Count -eq 0) 'Missing confirmation reached Azure.'

foreach ($failure in @('wrongTenant','foreignInventory','typeMismatch','wrongEndpoint','unknownConsumer','malformedRead')) {
    Reset-TestState
    $global:cleanupTest.$failure = $true
    Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $failure
    Assert-True ($global:cleanupTest.deleteAttempts -eq 0) "Preflight failure $failure allowed writes."
}

Reset-TestState
$protectedManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$protectedManifest.resources += @{ id = "/subscriptions/$sourceId/resourceGroups/rg_platform/providers/Microsoft.DomainRegistration/domains/terian-services.com"; type = 'Microsoft.DomainRegistration/domains'; order = 1 }
$protectedPath = Join-Path $testRoot 'protected-manifest.json'
[IO.File]::WriteAllText($protectedPath, ($protectedManifest | ConvertTo-Json -Depth 10))
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -ManifestPath $protectedPath -OutputDirectory $testRoot } 'protected manifest type'
Assert-True ($global:cleanupTest.calls.Count -eq 0) 'Protected manifest reached Azure.'

Reset-TestState
$foreignManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$foreignManifest.resources[0].id = $foreignManifest.resources[0].id.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667')
$foreignPath = Join-Path $testRoot 'foreign-manifest.json'
[IO.File]::WriteAllText($foreignPath, ($foreignManifest | ConvertTo-Json -Depth 10))
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -ManifestPath $foreignPath -OutputDirectory $testRoot } 'target resource in manifest'
Assert-True ($global:cleanupTest.calls.Count -eq 0) 'Target manifest reached Azure.'

Reset-TestState
& $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'execute')
Assert-True ($global:cleanupTest.deleteAttempts -eq 51) 'Full batch did not delete exactly 51 allowlisted resources.'
Assert-True ($global:cleanupTest.resources.Count -eq 7) 'Held resources were deleted.'
$execution = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'execute') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($execution.status -eq 'Completed') 'Completed batch status incorrect.'
Assert-True (@($execution.execution | Where-Object { $_.status -ne 'DeletedAndVerifiedAbsent' }).Count -eq 0) 'A delete was not verified.'
Assert-True ($execution.finalSourceIds.Count -eq 7) 'Final inventory missing held resources.'

# Rerun uses a fresh inventory: already-absent allowlist entries produce no deletes.
$global:cleanupTest.deleteAttempts = 0
& $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'rerun')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Rerun attempted already-absent resources.'

Reset-TestState
$global:cleanupTest.failDeleteAt = 2
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'delete-failure') } 'delete failure'
Assert-True ($global:cleanupTest.deleteAttempts -eq 2 -and $global:cleanupTest.deletedIds.Count -eq 1) 'Batch continued after a failed delete.'
$partial = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'delete-failure') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($partial.status -eq 'Stopped' -and $partial.execution[0].status -eq 'DeletedAndVerifiedAbsent' -and $partial.execution[1].errorCode -eq 'ScopeLocked') 'Partial execution report incorrect.'

Reset-TestState
$global:cleanupTest.denyVerify = $true
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'verify-failure') } '403 does not mean absent'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1) 'Batch continued after an unverifiable delete.'

Reset-TestState
$global:cleanupTest.injectConsumer = $true
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'consumer-race') } 'new source consumer'
Assert-True ($global:cleanupTest.deleteAttempts -eq 10) 'Shared infrastructure deleted despite a new source consumer.'

Reset-TestState
$global:cleanupTest.missingCode = 'NotFound'
& $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'generic-notfound')
Assert-True ($global:cleanupTest.deleteAttempts -eq 51 -and $global:cleanupTest.resources.Count -eq 7) 'Generic NotFound handling lost deletion verification or held resources.'

Reset-TestState
$global:cleanupTest.falseNotFoundId = $testManifest.resources[0].id
Expect-Failure { & $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'inconsistent-notfound') } 'NotFound is not proof if ID remains listed'
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Still-listed resource NotFound was treated as absence.'

Reset-TestState
$global:cleanupTest.vanishBeforeShowId = $testManifest.resources[0].id
& $scriptPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'disappeared-notfound')
Assert-True ($global:cleanupTest.deleteAttempts -eq 50) 'Disappeared exact resource was deleted again or batch stopped unnecessarily.'
$disappeared = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'disappeared-notfound') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($disappeared.status -eq 'Completed' -and $disappeared.execution[0].status -eq 'AlreadyAbsent') 'Disappeared resource was not recorded as AlreadyAbsent.'

# The second approved batch does not broaden deletion to arbitrary data IDs.
$manifestPath = Join-Path $PSScriptRoot '..\legacy-subscription-data-cleanup-manifest.json'
$testManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Reset-TestState
& $scriptPath -ManifestPath $manifestPath -OutputDirectory (Join-Path $testRoot 'data-preview')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Data preview issued writes.'
$dataPreview = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'data-preview') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($dataPreview.planned.Count -eq 9 -and $dataPreview.legacyDataDisposalApproved) 'Data preview does not contain exactly the approved nine targets.'

foreach ($failure in @('unapprovedName', 'missingApproval', 'missingEndpoint', 'wrongOrder', 'targetId')) {
    Reset-TestState
    $badData = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    switch ($failure) {
        'unapprovedName' { $badData.resources[0].id += '-unapproved' }
        'missingApproval' { $badData.legacyDataDisposalApproved = $false }
        'missingEndpoint' { $badData.resources = @($badData.resources | Where-Object { $_.type -ne 'Microsoft.Network/privateEndpoints' }) }
        'wrongOrder' { $badData.resources[3].order = 80 }
        'targetId' { $badData.resources[0].id = $badData.resources[0].id.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667') }
    }
    $badDataPath = Join-Path $testRoot ("data-$failure.json")
    [IO.File]::WriteAllText($badDataPath, ($badData | ConvertTo-Json -Depth 10))
    Expect-Failure { & $scriptPath -ManifestPath $badDataPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $failure
    Assert-True ($global:cleanupTest.calls.Count -eq 0) "Invalid disposal manifest $failure reached Azure."
}

Reset-TestState
$global:cleanupTest.resources += [pscustomobject]@{ id = "/subscriptions/$sourceId/resourceGroups/rg_corporate/providers/Microsoft.Network/privateEndpoints/unreviewed"; type = 'Microsoft.Network/privateEndpoints'; name = 'unreviewed'; resourceGroup = 'rg_corporate' }
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'unreviewed source endpoint'
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Unknown source endpoint allowed data disposal.'

foreach ($failure in @('wrongEndpoint', 'unknownConsumer')) {
    Reset-TestState
    $global:cleanupTest.$failure = $true
    Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $failure
    Assert-True ($global:cleanupTest.deleteAttempts -eq 0) "Disposal preflight $failure allowed writes."
}

Reset-TestState
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'data-execute')
Assert-True ($global:cleanupTest.deleteAttempts -eq 9 -and $global:cleanupTest.resources.Count -eq 5) 'Data execution deleted the wrong set.'
$dataExecution = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'data-execute') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($dataExecution.status -eq 'Completed' -and $dataExecution.execution.Count -eq 9) 'Data batch completion incorrect.'
$endpointDelete = [Array]::IndexOf($global:cleanupTest.deletedIds, $testManifest.resources[3].id)
$storageDelete = [Array]::IndexOf($global:cleanupTest.deletedIds, $testManifest.resources[7].id)
Assert-True ($endpointDelete -lt $storageDelete) 'Storage deleted before its endpoint.'
Assert-True (@($global:cleanupTest.resources | Where-Object { $_.type -eq 'Microsoft.DomainRegistration/domains' }).Count -eq 1) 'Registration was not preserved.'
Assert-True (@($global:cleanupTest.resources | Where-Object { $_.type -eq 'Microsoft.Network/dnszones' }).Count -eq 1) 'Public DNS was not preserved.'

$global:cleanupTest.deleteAttempts = 0
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'data-rerun')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Data rerun tried absent targets.'

Reset-TestState
$global:cleanupTest.failDeleteAt = 2
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'data delete fail-stop'
Assert-True ($global:cleanupTest.deleteAttempts -eq 2 -and $global:cleanupTest.deletedIds.Count -eq 1) 'Data disposal continued after failure.'

Reset-TestState
$global:cleanupTest.injectEndpoint = $true
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'endpoint recreated before storage disposal'
Assert-True ($global:cleanupTest.deleteAttempts -eq 5) 'Storage deleted with recreated endpoint present.'

foreach ($missingCode in @('NotFound', 'ResourceNotFound')) {
    Reset-TestState
    $global:cleanupTest.missingCode = $missingCode
    $global:cleanupTest.lagListsRemaining = 2
    $caseDirectory = Join-Path $testRoot ("data-inventory-lag-$missingCode")
    & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $caseDirectory
    $lagReport = Get-Content -LiteralPath @(Get-ChildItem $caseDirectory -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
    Assert-True ($global:cleanupTest.deleteAttempts -eq 9 -and $lagReport.status -eq 'Completed') 'Transient inventory lag stopped the batch.'
    Assert-True ($lagReport.execution[0].verificationAttempts -eq 3 -and $global:cleanupTest.sleeps -eq 2) 'Inventory lag was not retried until corroborated absence.'
}

Reset-TestState
$global:cleanupTest.showLagRemaining = 2
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'data-lookup-lag')
Assert-True ($global:cleanupTest.deleteAttempts -eq 9 -and $global:cleanupTest.sleeps -eq 2) 'A temporarily present lookup was not polled.'

Reset-TestState
$global:cleanupTest.missingCode = 'NotFound'
$global:cleanupTest.lagListsRemaining = 100
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -VerificationAttempts 3 -OutputDirectory (Join-Path $testRoot 'data-permanent-inventory-lag') } 'persistent inventory disagreement'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1 -and $global:cleanupTest.sleeps -eq 2) 'Persistent disagreement was ignored or retried without a bound.'
$timeoutReport = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'data-permanent-inventory-lag') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($timeoutReport.status -eq 'Stopped' -and $timeoutReport.execution[0].status -eq 'VerificationFailed' -and $timeoutReport.execution[0].deleteCommandSucceeded -and $timeoutReport.execution[0].verificationAttempts -eq 3) 'Timeout falsely reported verified deletion or lost the successful delete-command result.'

Reset-TestState
$global:cleanupTest.retainDeletedResource = $true
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -VerificationAttempts 3 -OutputDirectory $testRoot } 'resource remains present after delete'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1 -and $global:cleanupTest.sleeps -eq 2) 'Still-present resource was accepted as deleted.'

Reset-TestState
$global:cleanupTest.denyInventoryAfterDelete = $true
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'verification inventory permission error'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1 -and $global:cleanupTest.sleeps -eq 0) 'Authorization error was retried or treated as absence.'

Reset-TestState
$global:cleanupTest.finalLagRemaining = 2
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'data-final-inventory-lag')
Assert-True ($global:cleanupTest.deleteAttempts -eq 9 -and $global:cleanupTest.sleeps -eq 2) 'Final inventory lag was not polled.'

foreach ($failureCase in @(
    @{ name = 'plain'; text = 'ERROR: Synthetic transport failure'; code = 'UnknownAzureError'; message = 'Synthetic transport failure' },
    @{ name = 'json'; text = '{"error":{"code":"ScopeLocked","message":"Synthetic lock message"}}'; code = 'ScopeLocked'; message = 'Synthetic lock message' },
    @{ name = 'multiline'; text = "ERROR: Synthetic Azure failure`nCode: ResourceHasImmutableData`nMessage: Synthetic immutable data message"; code = 'ResourceHasImmutableData'; message = 'Synthetic immutable data message' },
    @{ name = 'sensitive'; text = 'ERROR: Authorization: Bearer synthetic-private-value'; code = 'UnknownAzureError'; message = 'Potentially sensitive error text omitted' },
    @{ name = 'empty'; text = ''; code = 'UnknownAzureError'; message = 'without captured error text' }
)) {
    Reset-TestState
    $global:cleanupTest.failDeleteAt = 1
    $global:cleanupTest.failureText = $failureCase.text
    $errorDirectory = Join-Path $testRoot ('data-error-' + $failureCase.name)
    Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $errorDirectory } $failureCase.name
    $errorReportPath = @(Get-ChildItem $errorDirectory -Recurse -Filter report.json)[0].FullName
    $errorReportText = Get-Content -LiteralPath $errorReportPath -Raw
    $errorReport = $errorReportText | ConvertFrom-Json
    Assert-True ($global:cleanupTest.deleteAttempts -eq 1 -and $errorReport.status -eq 'Stopped') 'Error reporting changed fail-stop behavior.'
    Assert-True ($errorReport.execution[0].deleteExitCode -eq 1 -and $errorReport.execution[0].errorCode -eq $failureCase.code -and $errorReport.execution[0].errorSummary.Contains($failureCase.message)) 'Failed delete lost its diagnostic summary.'
    Assert-True (-not $errorReportText.Contains('synthetic-private-value')) 'Credential was persisted in an error report.'
}

$manifestPath = Join-Path $PSScriptRoot '..\legacy-subscription-network-cleanup-manifest.json'
$testManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Reset-TestState
& $scriptPath -ManifestPath $manifestPath -OutputDirectory (Join-Path $testRoot 'network-preview')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Network preview issued writes.'
$networkPreview = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'network-preview') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($networkPreview.planned.Count -eq 18 -and $networkPreview.legacyNetworkDisposalApproved) 'Network preview target count/approval wrong.'

foreach ($failure in @('unapprovedName', 'missingApproval', 'wrongOrder', 'wrongLinkParent', 'wrongLinkVnet', 'targetId', 'missingZone')) {
    Reset-TestState
    $badNetwork = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    switch ($failure) {
        'unapprovedName' { $badNetwork.resources[0].id += '-unapproved' }
        'missingApproval' { $badNetwork.legacyNetworkDisposalApproved = $false }
        'wrongOrder' { $badNetwork.resources[1].order = 140 }
        'wrongLinkParent' { $badNetwork.resources[1].expectedZoneId += '-unapproved' }
        'wrongLinkVnet' { $badNetwork.resources[1].expectedVirtualNetworkId = $badNetwork.resources[1].expectedVirtualNetworkId.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667') }
        'targetId' { $badNetwork.resources[0].id = $badNetwork.resources[0].id.Replace($sourceId, '2bb69129-5e74-44d9-af68-96d45633f667') }
        'missingZone' { $badNetwork.resources = @($badNetwork.resources | Where-Object { $_.id -ne $badNetwork.resources[1].expectedZoneId }) }
    }
    $badNetworkPath = Join-Path $testRoot ("network-$failure.json")
    [IO.File]::WriteAllText($badNetworkPath, ($badNetwork | ConvertTo-Json -Depth 10))
    Expect-Failure { & $scriptPath -ManifestPath $badNetworkPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $failure
    Assert-True ($global:cleanupTest.calls.Count -eq 0) "Invalid network manifest $failure reached Azure."
}

foreach ($failure in @('targetLink', 'foreignLinkId', 'missingLinkTarget', 'unlistedLink', 'targetPeering', 'ipConfiguration', 'subnetEndpoint', 'serviceAssociation', 'navigationLink', 'missingVnetMetadata')) {
    Reset-TestState
    $global:cleanupTest.networkFailure = $failure
    Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $failure
    Assert-True ($global:cleanupTest.deleteAttempts -eq 0) "Network preflight failure $failure allowed writes."
}

foreach ($extra in @('Microsoft.Network/privateEndpoints/unreviewed', 'Microsoft.Storage/storageAccounts/unreviewed', 'Microsoft.Network/privateDnsZones/unreviewed.example')) {
    Reset-TestState
    $parts = $extra.Split('/')
    $global:cleanupTest.resources += [pscustomobject]@{ id = "/subscriptions/$sourceId/resourceGroups/rg_award_nomination_sandbox/providers/$extra"; type = "$($parts[0])/$($parts[1])"; name = $parts[-1]; resourceGroup = 'rg_award_nomination_sandbox' }
    Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } $extra
    Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Unreviewed source infrastructure allowed network writes.'
}

Reset-TestState
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'network-execute')
Assert-True ($global:cleanupTest.deleteAttempts -eq 18 -and $global:cleanupTest.resources.Count -eq 7) 'Network batch deleted the wrong set.'
$networkExecution = Get-Content -LiteralPath @(Get-ChildItem (Join-Path $testRoot 'network-execute') -Recurse -Filter report.json)[0].FullName -Raw | ConvertFrom-Json
Assert-True ($networkExecution.status -eq 'Completed') 'Network batch completion incorrect.'
foreach ($zone in @($testManifest.resources | Where-Object { $_.type -eq 'Microsoft.Network/privateDnsZones' })) {
    $zonePosition = [Array]::IndexOf($global:cleanupTest.deletedIds, $zone.id)
    foreach ($link in @($testManifest.resources | Where-Object { $_.type -eq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and $_.expectedZoneId -eq $zone.id })) {
        Assert-True ([Array]::IndexOf($global:cleanupTest.deletedIds, $link.id) -lt $zonePosition) 'Zone deleted before its links.'
    }
}
Assert-True (@($global:cleanupTest.resources | Where-Object { $_.type -eq 'Microsoft.Network/dnszones' }).Count -eq 1) 'Public DNS was not preserved.'
Assert-True (@($global:cleanupTest.resources | Where-Object { $_.type -eq 'Microsoft.DomainRegistration/domains' }).Count -eq 1) 'Registration was not preserved.'

$global:cleanupTest.deleteAttempts = 0
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'network-rerun')
Assert-True ($global:cleanupTest.deleteAttempts -eq 0) 'Network rerun tried absent targets.'

Reset-TestState
$global:cleanupTest.networkFailure = 'sourcePeering'
& $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory (Join-Path $testRoot 'network-source-peerings')
Assert-True ($global:cleanupTest.deleteAttempts -eq 18) 'Reviewed same-batch source peering wrongly blocked retirement.'

Reset-TestState
$global:cleanupTest.recreateKnownLink = $true
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'DNS link recreated before zone deletion'
Assert-True ($global:cleanupTest.deleteAttempts -eq 11) 'Zone deleted with recreated DNS link present.'

Reset-TestState
$global:cleanupTest.networkFailure = 'changedLinkTarget'
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'DNS link target changed after preflight'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1) 'Link to target VNet was deleted after preflight target change.'

Reset-TestState
$global:cleanupTest.injectEndpoint = $true
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'private endpoint recreated mid-network-batch'
Assert-True ($global:cleanupTest.deleteAttempts -eq 1) 'Network batch continued with recreated endpoint.'

Reset-TestState
$global:cleanupTest.failDeleteAt = 2
Expect-Failure { & $scriptPath -ManifestPath $manifestPath -Execute -ConfirmSubscription $sourceId -OutputDirectory $testRoot } 'network delete fail-stop'
Assert-True ($global:cleanupTest.deleteAttempts -eq 2 -and $global:cleanupTest.deletedIds.Count -eq 1) 'Network batch continued after failed deletion.'

Remove-Item Function:\az
Remove-Item Function:\Start-Sleep
Write-Host 'PASS: 71 offline scenarios; compute/data/network scope, dependency order, protected public DNS/registration, endpoint/link/peering guards, bounded verification and fail-stop.'
Write-Host "Synthetic reports retained at $testRoot"
