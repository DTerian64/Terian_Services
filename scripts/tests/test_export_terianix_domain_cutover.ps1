#requires -Version 5.1
# Offline tests: az is a local mock function; no Azure/network calls are made.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$scriptPath = Join-Path $PSScriptRoot "..\export-terianix-domain-cutover.ps1"
$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ("terianix-domain-tests-" + [Guid]::NewGuid().ToString("N"))
$global:terianixDomainTestState = [pscustomobject]@{
    reads = @()
    failRead = $false
    wrongTenant = $false
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (!$Condition) { throw $Message }
}

function az {
    $cliArguments = @($args)
    $global:terianixDomainTestState.reads += ,$cliArguments
    $global:LASTEXITCODE = 0
    if ($global:terianixDomainTestState.failRead) {
        $global:LASTEXITCODE = 1
        return
    }
    $joined = $cliArguments -join " "
    $subscriptionIndex = [Array]::IndexOf($cliArguments, "--subscription")
    if ($subscriptionIndex -lt 0) { throw "Missing explicit subscription." }
    $subscription = $cliArguments[$subscriptionIndex + 1]
    $isSource = $subscription -eq "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca"
    $tenant = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
    if ($isSource) { $tenant = "4d5f34d3-d97b-40c7-8704-edff856d3654" }
    if ($global:terianixDomainTestState.wrongTenant) { $tenant = "unexpected-tenant" }
    if ($joined -match "^account show ") {
        return (@{ id = $subscription; tenantId = $tenant } | ConvertTo-Json)
    }
    if ($joined -match "^network dns zone show ") {
        return (@{ name = "terian-services.com"; nameServers = @("ns1.test", "ns2.test", "ns3.test", "ns4.test") } | ConvertTo-Json)
    }
    if ($joined -match "^network dns record-set list ") {
        return (ConvertTo-Json -Depth 10 -InputObject @(
            @{ name = "@"; type = "Microsoft.Network/dnszones/A"; ttl = 3600; targetResource = @{ id = "/subscriptions/$subscription/resourceGroups/test/providers/Microsoft.Web/staticSites/old" } },
            @{ name = "@"; type = "Microsoft.Network/dnszones/MX"; ttl = 3600; mxRecords = @(@{ preference = 10; exchange = "mx.example.test" }) }
        ))
    }
    if ($joined -match "^staticwebapp list ") {
        $suffix = ""
        if (!$isSource) { $suffix = "-platform" }
        return (ConvertTo-Json -InputObject @(
            @{ id = "/subscriptions/$subscription/resourceGroups/test/providers/Microsoft.Web/staticSites/terian-services-frontend$suffix"; name = "terian-services-frontend$suffix"; resourceGroup = "test"; defaultHostname = "terian.5.azurestaticapps.net" },
            @{ id = "/subscriptions/$subscription/resourceGroups/test/providers/Microsoft.Web/staticSites/terianix-frontend$suffix"; name = "terianix-frontend$suffix"; resourceGroup = "test"; defaultHostname = "terianix.2.azurestaticapps.net" }
        ))
    }
    if ($joined -match "^staticwebapp hostname list ") {
        return "[]"
    }
    if ($joined -match "^resource list ") {
        return (ConvertTo-Json -InputObject @(@{ id = "/subscriptions/$subscription/resourceGroups/test/providers/Microsoft.DomainRegistration/domains/terian-services.com"; name = "terian-services.com" }))
    }
    if ($joined -match "^resource show ") {
        $idIndex = [Array]::IndexOf($cliArguments, "--ids")
        $id = $cliArguments[$idIndex + 1]
        if ($id -match "Microsoft.DomainRegistration") {
            Assert-True ($joined -notmatch "contact|authCode") "Registrant data was requested."
            return (@{ id = $id; name = "terian-services.com"; dnsZoneId = "historical-zone"; autoRenew = $true } | ConvertTo-Json)
        }
        $hostname = "terian.5.azurestaticapps.net"
        if ($id -match "/terianix-") { $hostname = "terianix.2.azurestaticapps.net" }
        return (@{ id = $id; name = ($id -split "/")[-1]; defaultHostname = $hostname; stableInboundIP = "192.0.2.10" } | ConvertTo-Json)
    }
    throw "Unapproved CLI operation in test: $joined"
}

foreach ($side in @("Source", "Target", "Source")) {
    & $scriptPath -Side $side -OutputDirectory $testDirectory
}
$snapshots = @(Get-ChildItem -LiteralPath $testDirectory -Recurse -Filter snapshot.json)
Assert-True ($snapshots.Count -eq 3) "Repeated runs overwrote a snapshot."
foreach ($file in $snapshots) {
    $snapshot = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    Assert-True ($snapshot.recordSets.Count -eq 2) "Record sets were lost."
    Assert-True ($null -ne $snapshot.recordSets[0].targetResource.id) "Alias target was lost."
    Assert-True ($snapshot.recordSets[1].mxRecords[0].exchange -eq "mx.example.test") "Mail records changed."
    Assert-True ($snapshot.sites.Count -eq 2) "SWA metadata was lost."
    Assert-True ($snapshot.sites[0].slice -eq "5" -and $snapshot.sites[1].slice -eq "2") "SWA slices were classified incorrectly."
}

foreach ($failure in @("failRead", "wrongTenant")) {
    $global:terianixDomainTestState.$failure = $true
    $threw = $false
    try { & $scriptPath -Side Source -OutputDirectory $testDirectory }
    catch { $threw = $true }
    $global:terianixDomainTestState.$failure = $false
    Assert-True $threw "The exporter continued after $failure."
}
Assert-True (@(Get-ChildItem -LiteralPath $testDirectory -Recurse -Filter snapshot.json).Count -eq 3) "Failed export produced a snapshot."
Assert-True ($global:terianixDomainTestState.reads.Count -gt 0) "No mocked reads exercised."
Write-Host "PASS: source/target exports, unique snapshots, alias/mail preservation, slices, failed reads, and tenant guard."
Write-Host "Synthetic test files retained at: $testDirectory"
