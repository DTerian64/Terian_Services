#requires -Version 5.1
<#
.SYNOPSIS
Export read-only Azure metadata for the two-domain migration.
.DESCRIPTION
Run separately while signed into each tenant. Uses only account/resource/DNS
reads, with an explicit subscription on every Azure call. Does not log in,
change subscription context, create bindings, edit DNS, run Terraform, or
contact Cloudflare. Writes a new, private local snapshot directory per run.
No deployment tokens, application settings, or registrant contact data are
exported. DNS TXT records can contain verification tokens; do not commit them.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Source", "Target")]
    [string]$Side,

    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\terraform_terianix_platform\domain-cutover-local")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-DomainRead {
    param([string[]]$Arguments)
    $raw = & az @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) {
        throw "An Azure read failed. No complete snapshot was written. Check tenant access and retry."
    }
    return (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Get-SwaSlice {
    param([string]$Hostname)
    if ($Hostname -match "\.(\d+)\.azurestaticapps\.net$") {
        return $Matches[1]
    }
    return "unknown - inspect the complete hostname"
}

Get-Command az -ErrorAction Stop | Out-Null

if ($Side -eq "Source") {
    $subscription = "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca"
    $tenant = "4d5f34d3-d97b-40c7-8704-edff856d3654"
    $zoneResourceGroup = "rg_platform"
    $siteNames = @("terian-services-frontend", "terianix-frontend")
} else {
    $subscription = "2bb69129-5e74-44d9-af68-96d45633f667"
    $tenant = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
    $zoneResourceGroup = "rg_terianix_platform"
    $siteNames = @("terian-services-frontend-platform", "terianix-frontend-platform")
}

$account = Invoke-DomainRead @("account", "show", "--subscription", $subscription,
    "--query", "{id:id,tenantId:tenantId}")
if ($account.id -ne $subscription -or $account.tenantId -ne $tenant) {
    throw "Connect Azure CLI to the $Side tenant $tenant before exporting."
}

$zone = Invoke-DomainRead @("network", "dns", "zone", "show",
    "--subscription", $subscription, "--resource-group", $zoneResourceGroup,
    "--name", "terian-services.com")
$recordSets = @(Invoke-DomainRead @("network", "dns", "record-set", "list",
    "--subscription", $subscription, "--resource-group", $zoneResourceGroup,
    "--zone-name", "terian-services.com"))

# Discover the source resource groups rather than assume a historical SWA move
# between rg_platform and rg_corporate has or has not taken place.
$sites = @(Invoke-DomainRead @("staticwebapp", "list", "--subscription", $subscription,
    "--query", "[].{id:id,name:name,resourceGroup:resourceGroup,defaultHostname:defaultHostname}"))
$selectedSites = @()
foreach ($siteName in $siteNames) {
    $matchingSites = @($sites | Where-Object { $_.name -eq $siteName })
    if ($matchingSites.Count -ne 1) {
        throw "Expected exactly one '$siteName' in $subscription; found $($matchingSites.Count)."
    }
    $site = $matchingSites[0]
    $metadata = Invoke-DomainRead @("resource", "show", "--subscription", $subscription,
        "--ids", $site.id, "--api-version", "2023-12-01",
        "--query", "{id:id,name:name,defaultHostname:properties.defaultHostname,stableInboundIP:properties.stableInboundIP}")
    if ([string]::IsNullOrWhiteSpace([string]$metadata.defaultHostname)) {
        throw "Missing default hostname for '$siteName'; snapshot cannot classify the SWA slice."
    }
    $bindings = @(Invoke-DomainRead @("staticwebapp", "hostname", "list",
        "--subscription", $subscription, "--resource-group", $site.resourceGroup,
        "--name", $site.name,
        "--query", "[].{id:id,name:name,domainName:domainName,status:status}"))
    $selectedSites += [ordered]@{
        id = $metadata.id
        name = $metadata.name
        resourceGroup = $site.resourceGroup
        defaultHostname = $metadata.defaultHostname
        slice = Get-SwaSlice ([string]$metadata.defaultHostname)
        stableInboundIP = $metadata.stableInboundIP
        customDomains = $bindings
    }
}

$registrations = @()
if ($Side -eq "Source") {
    $domains = @(Invoke-DomainRead @("resource", "list", "--subscription", $subscription,
        "--resource-type", "Microsoft.DomainRegistration/domains",
        "--query", "[?name=='terian-services.com'].{id:id,name:name}"))
    foreach ($domain in $domains) {
        $registrations += Invoke-DomainRead @("resource", "show",
            "--subscription", $subscription, "--ids", $domain.id,
            "--api-version", "2023-12-01",
            "--query", "{id:id,name:name,dnsType:properties.dnsType,dnsZoneId:properties.dnsZoneId,nameServers:properties.nameServers,registrationStatus:properties.registrationStatus,autoRenew:properties.autoRenew,expirationTime:properties.expirationTime}")
    }
}

$snapshot = [ordered]@{
    schemaVersion = 1
    side = $Side
    exportedUtc = [DateTime]::UtcNow.ToString("o")
    subscriptionId = $subscription
    tenantId = $tenant
    zone = $zone
    recordSets = $recordSets
    sites = $selectedSites
    domainRegistrations = $registrations
}

# A unique child directory avoids overwriting rollback evidence on repeat runs.
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$runName = "{0}-{1}-{2}" -f $Side.ToLowerInvariant(),
    [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ"), [Guid]::NewGuid().ToString("N").Substring(0, 8)
$runDirectory = Join-Path $outputRoot $runName
New-Item -ItemType Directory -Path $runDirectory -ErrorAction Stop | Out-Null
$snapshotPath = Join-Path $runDirectory "snapshot.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($snapshotPath, ($snapshot | ConvertTo-Json -Depth 100), $utf8)

Write-Host "Read-only $Side snapshot: $snapshotPath"
Write-Host "terian-services.com record sets: $($recordSets.Count)"
Write-Host "Zone name servers: $($zone.nameServers -join ', ')"
foreach ($site in $selectedSites) {
    Write-Host "$($site.name): $($site.defaultHostname) (slice $($site.slice))"
}
Write-Host "No Azure, Terraform, DNS, or Cloudflare settings were changed."
Write-Host "Also export terianix.ai in Cloudflare: DNS > Records > Import and Export > Export."
