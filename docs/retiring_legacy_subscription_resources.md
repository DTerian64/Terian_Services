# Retiring legacy subscription resources while the domain move is deferred

Updated: October 13, 2026 (America/Los_Angeles).

## Decision and current status

David chose to defer the App Service Domain move and remove old resources that
are no longer needed, prioritizing cost reduction. David executes all live
Azure, Terraform, and Cloudflare operations. Codex prepares local procedures;
no deletion, Azure query, or live Terraform operation has been performed by Codex.
Source backups remain waived. That waiver does not establish that remaining
application dependencies or uncopied business data can be discarded.
David subsequently confirmed the data copy is complete and explicitly requested
all remaining legacy Cosmos DB, Static Web Apps and storage accounts be removed.
The batch below implements that decision without another backup or
reconciliation gate. Other resource categories remain separately scoped.

The source subscription is `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca`. Its directory
change to Terianix Platform tenant `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` completed,
and David confirmed Owner access to both subscriptions. The target subscription
remains `2bb69129-5e74-44d9-af68-96d45633f667`.

The existing App Service Domain move failed during execution with
`ProviderMoveNotificationFailed`, inner `BadRequest`, extended code `59743`:
the target subscription is not eligible to create an App Service Domain.
Target checks returned Pay-As-You-Go, Enabled, spending limit Off, and
Microsoft.DomainRegistration Registered. The precise remaining eligibility
restriction is unknown. Support/registration work is deferred, not completed.
Latest move correlation ID: `e9e7482d-e484-4281-8971-fb93b2e19fb0`.

## Latest requested cleanup: Recovery Services vault in Cloud Shell

David reports `hub-spoke-demo` deletion failed with its only remaining resource
`vault-m8qbevi0`, and supplied Azure's generated deletion script for adaptation.
The Cloud Shell version is prepared and tested offline, not run against Azure.
See [Vault cleanup procedure](deleting_legacy_recovery_vault_cloudshell.md).
Preview is read-only; execution requires explicit confirmation of this vault
and discards its listed cloud backup data. Security/retention protections are
unchanged; ASR/private endpoints/on-premises dependencies require separate review.
The first Cloud Shell run stopped at ASR context initialization with a null
reference before any deletion. The updated script uses a scoped REST GET for
ASR fabrics instead; all 26 mocked tests passed. Re-upload and preview the
corrected version. The vault and group are not yet verified deleted.

## Latest identity decision: retain and rename Rideshare David64 Organization

On October 13, David reported the legacy tenant deletions complete except for
**Rideshare David64 Organization**, which is now retained. This supersedes the
earlier all-three deletion approval below. Deletion of `acmenoms.onmicrosoft.com`
and `syntheticawards.onmicrosoft.com` is operator-reported; a fresh source ARM
inventory has not yet verified removal of their associated CIAM resources.
The last locally verified inventory remains the 12-entry network-batch report.

Retain the original workforce directory
`4d5f34d3-d97b-40c7-8704-edff856d3654`. David requests its display name changed
to **Terian Services Inc.** and guest access for
`david.admin@terianix.onmicrosoft.com`. These changes are pending, not completed
by Codex. Display-name editing does not relocate subscriptions or change DNS.
Do not delete the source `RideshareDavid64.onmicrosoft.com` CIAM resource based
on its name alone; its directory mapping and retained billing linkage remain
separately reviewed.

Operator procedure: sign in as the existing administrator
`david64.terian@terian-services.com`, switch to the exact retained directory,
then **Entra ID > Overview > Properties > Name**, enter `Terian Services Inc.`
and save. Leave domain names and all other settings unchanged. Next choose
**Users > New user > Invite external user**, enter the full Terianix admin
address and display name `David Admin`, and invite it as a guest. Do not create
a new local account or automatically grant Global Administrator. If the invited
account has no mailbox, redeem via a tenant-specific direct link while signed
in as the invited account. Verify acceptance and the new directory appears.
Administrative role assignment requires a separate access-level decision;
guest membership alone is not administrative access. Keep the existing
administrator account.

References: [Tenant display-name properties](https://microsoftlearning.github.io/SC-300-Identity-and-Access-Administrator/Instructions/Labs/Lab_02_WorkingWithTenantProperties.html),
[Guest invitation](https://learn.microsoft.com/en-us/entra/external-id/b2b-quickstart-add-guest-users-portal),
[Direct-link redemption](https://learn.microsoft.com/en-us/entra/external-id/redemption-experience).

## Earlier approval: retire the three legacy CIAM tenants (partly superseded)

David confirmed all legacy tenant replacements exist in the new subscription
and the old tenants are disposable. This clears the customer-identity hold
for the following three source CIAM resources, not for the Terianix Platform
workforce directory that now owns both subscriptions:

| Source group | CIAM resource |
| --- | --- |
| `rg_platform` | `acmenoms.onmicrosoft.com` |
| `rg_platform` | `RideshareDavid64.onmicrosoft.com` |
| `rg_award_nomination_sandbox` | `syntheticawards.onmicrosoft.com` |

Deletion is approved but not performed or verified. Do not add these resources
to the generic bulk runner: Microsoft's CIAM delete API specifies that Azure
resource deletion is the final step of the tenant deletion process. Removing
a subscription billing resource is not a safe substitute for that process.

David executes the following for each listed legacy external tenant:

1. Open its source Azure resource and read `properties.tenantId` in JSON View.
   Compare this GUID with the replacement tenant's GUID, not just its display
   name or subscription. A moved billing link to the same directory is not an
   independent replacement. Stop if the IDs match, cannot be established, or
   the selected directory is Terianix Platform
   (`5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`).
2. Sign in to the Microsoft Entra admin center as a Global Administrator of
   that exact legacy external tenant. Subscription Owner or Global Administrator
   of the Terianix workforce tenant does not establish this separate access.
3. Switch to the verified legacy tenant, then open **Entra ID > Overview >
   Manage tenants**, select that tenant and choose **Delete** to inspect checks.
4. Complete the checks only inside this approved legacy tenant: remove obsolete
   users (retain the deleting Global Administrator), app registrations including
   `b2c-extensions-app`, and any user flows or other blockers the portal reports.
   Do not purge objects or bypass retention automatically. Then confirm deletion.
5. Record the deleted tenant GUID and completion result. Switch back to Terianix
   Platform and verify its exact source CIAM resource is absent from a fresh
   inventory. If the directory is gone but its Azure resource remains, inspect
   the resource's error/state before selecting the final cleanup action; do not
   blindly delete unrelated directory resources or their groups.

Repeat for all three. The expected source inventory becomes nine entries only
after all three Azure resources are verified absent. Four Network Watchers,
one Recovery Services vault, one Azure DevOps account, two public DNS zones and
the domain registration remain separately scoped. Do not cancel the legacy
subscription while it owns the registration.

References: [Delete an external tenant](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-delete-external-tenant-portal),
[CIAM tenant deletion API](https://learn.microsoft.com/en-us/rest/api/activedirectory/ciam-tenants/delete?view=rest-activedirectory-2023-05-17-preview),
[CIAM tenant metadata](https://learn.microsoft.com/en-us/rest/api/activedirectory/ciam-tenants/get?view=rest-activedirectory-2023-05-17-preview).

## Completed approval: legacy Award private DNS, Service Bus and VNets

David explicitly requested deletion of all unused private DNS zones in
`rg_award_nomination_sandbox`, then added Service Bus and both VNets. This clears
the former private-DNS/shared-network and namespace messaging holds for these
exact legacy resources. Remaining namespace messages are disposed of, not
drained or replayed. Public DNS, registration and customer identity directories
are not part of this request.

The data batch is **completed**, confirmed by the local operator report
`legacy-subscription-cleanup-20261013T033748Z-866257bb/report.json`, finished at
03:40 UTC October 13 (October 12 locally). All nine explicit data-batch IDs are
absent. That report lists **30 remaining source resource entries**; the storage
endpoint's managed NIC is also gone. Codex inspected local files only.

Use `scripts/legacy-subscription-network-cleanup-manifest.json` with the existing
runner. All 18 IDs match that completed local report:

| Order | Explicit targets |
| --- | --- |
| 100 | `sb-award-sandbox` (Service Bus namespace), including its queues/topics/messages |
| 110 | Ten private DNS VNet links: primary and secondary links for each of the five zones |
| 120 | `privatelink.database.windows.net`, `privatelink.openai.azure.com`, `privatelink.vaultcore.azure.net`, `privatelink.azurecr.io`, `privatelink.blob.core.windows.net` |
| 130 | `vnet-award-primary-sandbox`, `vnet-award-secondary-sandbox` |

Every target is in source subscription
`4ddf12bb-5397-445f-bcaa-df4c7d3dfdca`, group `rg_award_nomination_sandbox`.
The Blob private DNS zone is now included because the data batch is complete
and David explicitly approved all five zones. DNS records are deleted with
their zone. VNet links must be deleted before their parent zone. No recursive
resource-group deletion, backup, lock removal or purge is performed.

David runs from the local repository root:

```powershell
# Read-only preview; review all DELETE and KEEP entries.
.\scripts\retire-legacy-subscription-resources.ps1 -ManifestPath .\scripts\legacy-subscription-network-cleanup-manifest.json

# Execute the whole reviewed network/messaging batch.
.\scripts\retire-legacy-subscription-resources.ps1 -ManifestPath .\scripts\legacy-subscription-network-cleanup-manifest.json -Execute -ConfirmSubscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca
```

The runner pins the 18 IDs, types, link parents/targets and dependency order.
Preflight rejects new/unreviewed network resources, surviving source private
endpoints or Award data services, links to other/target VNets, and occupied
subnets. VNet IP configurations, private endpoints, service-association links
and navigation links must be absent. Peering is allowed only between the two
reviewed source VNets when both are in this batch. Missing dependency metadata
or failed reads stop before writes. Link target changes, recreated links and
new private endpoints during execution also stop later deletion. Each delete
is verified with bounded lookup/inventory polling and logged; successful earlier
deletions are not rolled back if a later action fails.

This batch is **completed**, confirmed by David and the local operator report
`legacy-subscription-cleanup-20261013T035850Z-6d9d3007/report.json`, finished
at 04:21 UTC October 13 (October 12 locally). All 18 execution records are
`DeletedAndVerifiedAbsent`. The final source inventory contains **12 entries**:
two public DNS zones, one domain registration, three CIAM resources, four
Network Watchers, one Recovery Services vault and one Azure DevOps account.
The subsequent CIAM approval above is not a completed deletion.
All 71 offline mock scenarios passed before execution. Codex inspected local
reports only and ran no Azure reads or writes. Do not cancel the source
subscription while it still owns the domain registration.

References: [Private DNS zone deletion](https://learn.microsoft.com/en-us/cli/azure/network/private-dns/zone#az-network-private-dns-zone-delete),
[VNet link deletion](https://learn.microsoft.com/en-us/cli/azure/network/private-dns/link/vnet#az-network-private-dns-link-vnet-delete).

## Completed approval: bulk Cosmos, Static Web Apps and storage disposal

**Earlier operator update:** David confirmed `AZ-305/az305storage1964` deleted
after the manual container/version cleanup. The lab account blocker is cleared;
no Azure query or deletion was performed by Codex. Earlier failed attempts below
are historical. The next expected targets are the three storage accounts
`rg_platform/awardnomplatform`, `rg_award_nomination_sandbox/stawardnomssandbox`
and `rg_corporate/stterianservices`. The subsequent completed report above
confirms all three absent; the earlier pending status below is historical.

Resume the existing nine-ID data manifest rather than creating another slice.
The script reads a fresh source inventory, skips absent IDs (including the lab
account), and verifies each remaining deletion. Review the printed plan if it
differs from these expected targets. Registration, public/private DNS, CIAM,
Service Bus, vaults, networking, Azure DevOps and target resources remain outside
this batch. A completed report is needed before preparing the next category.

The first compute batch is **completed**, confirmed by David and its local
`legacy-subscription-cleanup-20261013T012256Z-615f37ba/report.json`, finished
October 13 at 01:36 UTC (October 12 locally). Every original explicit target
was verified absent; **40 source resource entries remain** in that report.
This is not subscription retirement.

David confirmed the data copy is complete and requested removal of all legacy
Cosmos DB, SWAs and storage accounts. The previous data/frontend holds are
cleared for these exact resources. No new backup or final-copy project is needed.

Use the existing script with the **new** manifest
`scripts/legacy-subscription-data-cleanup-manifest.json`. Its nine exact targets,
checked locally against that completed report, are:

| Category | Source resources |
| --- | --- |
| Static Web Apps (3) | `rg_platform/terian-services-frontend`; `rg_corporate/terianix-frontend`; `rg_award_nomination_sandbox/award-nomination-frontend-sandbox` |
| Storage endpoint (1), before storage | `rg_award_nomination_sandbox/pe-stawardnomssandbox` |
| Cosmos DB (1) | `rg_corporate/terian-services-cosmos-db` |
| Storage accounts (4) | `rg_corporate/stterianservices`; `rg_platform/awardnomplatform`; `rg_award_nomination_sandbox/stawardnomssandbox`; `AZ-305/az305storage1964` |

This intentionally removes legacy blobs, storage queues, old Terraform state,
and other source account contents without backups. Historical signed source
URLs will cease working. Freeze legacy deployment/apply workflows: do not
reapply old Terraform to repair this deliberate deletion. The target platform
backend uses `stterianixtfstate`, not the source `awardnomplatform`.

Source SWA bindings/default endpoints are removed. Any required hostname still
pointing at a source SWA, including an apex alias, can fail; outage is accepted
and DNS corrections remain separate operator work. Deleting an SWA does not
automatically repoint DNS to its target replacement. Domain registration,
public/private DNS records, CIAM directories, Service Bus, Recovery Services,
Network Watchers, VNets, Azure DevOps and all target resources are untouched.
The endpoint's managed NIC is left to Azure's parent deletion lifecycle; it is
not directly selected. The remaining count comes from the final report, not
subtracting nine, because managed children may also disappear.

David runs from the repository root:

```powershell
# Read-only preview of this new batch.
.\scripts\retire-legacy-subscription-resources.ps1 -ManifestPath .\scripts\legacy-subscription-data-cleanup-manifest.json

# Execute the whole reviewed batch, without per-resource prompts.
.\scripts\retire-legacy-subscription-resources.ps1 -ManifestPath .\scripts\legacy-subscription-data-cleanup-manifest.json -Execute -ConfirmSubscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca
```

The new types require exact pinned IDs and an approved-disposal manifest. The
storage endpoint's connection must match the exact legacy Award storage ID;
its deletion precedes storage. Unreviewed source application consumers or
private endpoints block preflight. A recreated private endpoint blocks storage
deletion. Existing tenant/subscription guards, absence verification, resumable
reports and stop-on-error behavior remain. No lock removal or purge is automated.

David executed this second batch; it was initially partial and is now **completed**
by the final operator report identified above. Codex has
performed no live Azure operations. Earlier hold statements below describe the
first batch and do not override the disposal approval.

### Second batch: successful delete command, inconsistent absence checks

The local operator report
`legacy-subscription-cleanup-20261013T020418Z-40a20ecb/report.json` records:

- `award-nomination-frontend-sandbox`: deleted and verified absent.
- `rg_corporate/terianix-frontend`: delete command returned success, then the
  exact resource lookup returned generic `NotFound` while a fresh source
  inventory still listed its ID. Its deletion is not yet verified.
- Later targets, including the storage endpoint, Cosmos and all storage
  accounts: not reached by this run.

This is a verification disagreement, not a reported delete-command failure.
Delayed inventory convergence is plausible, but that report alone does not
prove the precise Azure-side cause or final absence.

The script now polls after successful deletion: up to 12 checks with 10 seconds
between retries, plus the time spent on Azure CLI calls. Both the exact lookup
and a successful fresh inventory must establish absence. Persistent presence
or disagreement stops the batch; permission/authentication errors stop without
retrying or treating them as absence. The final batch inventory is also polled.
Pre-delete lookup inconsistencies remain strict failures; the change does not
authorize deleting around unverified metadata or new consumers.

Reports now distinguish `Verifying`/`VerificationFailed`, record the successful
delete-command result, and count verification attempts. Rerun the same data-batch
command above: its fresh plan skips IDs already absent. Keep the original
partial report. No manifest scope, protection, locks or purge behavior changed.
Codex verifies the change offline with mocked Azure calls and mocked retry
delays, including transient/persistent mismatches and permission failures.

### Second-batch rerun: Cosmos/endpoint removed; storage deletion blocked

The subsequent local operator report
`legacy-subscription-cleanup-20261013T021540Z-0fac08ac/report.json` confirms
`rg_platform/terian-services-frontend`, `pe-stawardnomssandbox` and
`rg_corporate/terian-services-cosmos-db` deleted and verified absent. It then
records a failed delete of `AZ-305/az305storage1964`, error `UnknownAzureError`,
with no successful delete-command result. The other three storage accounts were
not reached. No storage-account absence is confirmed by this run.

David also tried deleting that same account through the Azure portal, which
reported failure. The precise cause is unknown: the original batch report
discarded the native command error text. Do not assume a lock, policy,
immutability, or retention blocker without its actual error. Soft delete and
versioning in the supplied overview are not proof of an account-deletion blocker.

Next diagnostic: on this account, open Activity log, select the newest failed
Delete Storage Account operation, and inspect its JSON `properties.statusMessage`
and correlation ID. Share the code/message, not authentication headers. No
protection removal, purge or group deletion is authorized as a diagnostic step.

Failed-delete reports now retain CLI exit code and a short credential-filtered
error summary. This does not recover the discarded text from the earlier run
or fix the Azure-side failure. All 43 offline scenarios passed; no live Azure
operations were performed by Codex.

### Storage-service deletion protection identified

David supplied the matching failed `EndRequest` event for
`AZ-305/az305storage1964`, correlation ID
`d10ddec4-abeb-406b-8658-59b5401f8d17`. It reports HTTP 409 Conflict,
`AccountProtectedFromDeletion`: `az305storage1964 is protected from deletion.`
This is the actual storage-service blocker, not the earlier Started event or
a generic CLI classification. The precise protection scope/policy is not yet
identified. No new live queries or protection changes were performed by Codex.

Next, inspect Data storage > Containers and each relevant container's Access
policy / immutable storage configuration for legal holds, locked time-based
retention, or version-level immutability. Do not treat ordinary blob soft delete
or versioning alone as this diagnosis. Locked retention cannot be shortened or
removed to force deletion; identify the policy and expiry before deciding the
supported cleanup route. No blanket legal-hold removal is prescribed.

References: [Storage deletion protection](https://learn.microsoft.com/troubleshoot/azure/azure-storage/blobs/recovery/data-protection-backup-recovery),
[Container immutability policy states](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-policy-configure-container-scope).

### Lab container: version-level immutability support confirmed

David supplied `myblob` Access policy showing no container immutability policies,
then reported that container deletion is blocked by
`ImmutableStorageWithVersioning`. This identifies version-level immutability
support, not necessarily an active locked retention policy. The supported order
is to delete all deletable blobs and their versions, delete the empty container,
then delete the account after all its containers are gone. Inspect each blob's
Versions tab, including Show deleted versions, to distinguish remaining live
versions from soft-deleted versions or versions under actual retention/holds.
Deleting only the current blob preserves previous versions; an empty current
blob listing is not proof of an empty container. Locked retention on a version
cannot be bypassed. The subsequent operator-run version cleanup used exact
version IDs and did not bypass retention. Its original strict-false filter
matched no records; inspection showed unset previous-version flags and JSON
timestamps parsed as dates. The corrected selection excluded true current/deleted
flags and used `ConvertFrom-Json -DateKind String` to preserve version IDs.
David subsequently confirmed the storage account deleted, as recorded above.

## Earlier approval: one bulk compute retirement batch

David confirmed all old-subscription application compute is disposable,
including payroll-broker, auxiliary/integrity services and scheduled jobs.
Those services have been recreated in the target subscription. David supplied
the target `award-payroll-broker-sandbox` ID in subscription
`2bb69129-5e74-44d9-af68-96d45633f667`, group `rg_award_nomination_sandbox`.
The target subscription now has the distinct display name
"Terianix Platform Subscription"; scripts still use immutable subscription IDs.
This clears the old compute-consumer hold, not the outstanding data/queue,
identity-directory or domain/DNS holds. No new Azure operation by Codex occurred.

Use one batch instead of the historical per-resource slices below:

- Script: `scripts/retire-legacy-subscription-resources.ps1`.
- Exact 51-entry allowlist: `scripts/legacy-subscription-cleanup-manifest.json`.
- Offline mock tests: `scripts/tests/test_retire_legacy_subscription_resources.ps1`.

The allowlist covers 7 old Container Apps, 2 jobs, 1 Logic App, old Front Door
profile/WAF, 4 service private endpoints, 3 Container Apps environments, 2 each
of registries/OpenAI/Key Vaults, 8 managed identities, and old monitoring,
alerts and dashboards. Server SQL was previously deleted; its endpoint is
included only if still present. Names shared with target resources never
authorize target deletion. Managed child resources can disappear with their
parents, so 51 entries is not a promise of 51 new deletions or 51 billable units.

Before execution, freeze legacy deployment/apply workflows. This batch
deliberately terminates old application endpoints; remaining DNS or frontend
bundles pointing at them can fail even while target apps remain intact. Fix
those routes manually/in the reviewed Terraform route, not by deleting public
DNS or changing Cloudflare here. Source SWAs are explicitly retained for now
because remaining apex/alias/Cloudflare routing has not been fully verified.
Their retained appearance does not mean their old API backend will stay online.

David runs from the repository root, signed into Terianix Platform:

```powershell
# Preview: Azure metadata reads only; no resource changes.
.\scripts\retire-legacy-subscription-resources.ps1
```

Only after reviewing the DELETE and KEEP IDs and accepting source endpoint
retirement, run the separate execution command:

```powershell
.\scripts\retire-legacy-subscription-resources.ps1 -Execute -ConfirmSubscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca
```

There are no per-resource prompts in Execute mode: the explicit confirmation
parameter authorizes the entire reviewed batch. Each resource is deleted in
dependency order, verified absent, and recorded. A failure stops later deletion
and saves partial progress; successful earlier deletions are not rolled back.
Already-absent resources are skipped on rerun. No locks, purges, whole groups,
Terraform state, Cloudflare, subscription cancellation, or target resources
are changed. Preview/execute each read a fresh inventory; review a changed
plan rather than assuming the previous preview applies forever.

Guards enforce fixed source subscription and new tenant, approved types/groups,
source-only IDs, inventory type consistency, and private-endpoint connection
targets. Unknown source apps/jobs/Logic Apps block execution before the first
write; source consumers recreated during the batch block shared-infrastructure
deletion. The script requests only metadata, not application secrets, keys,
tokens or registrant contacts. Post-delete authentication errors are not treated
as proof of absence.

Metadata reports are saved in unique ignored directories beneath
`terraform_terianix_platform/domain-cutover-local/legacy-subscription-cleanup-*/report.json`.
Keep and inspect the report if the run stops. Completed status applies only to
this allowlist, not whole-subscription retirement. Source data, queues, customer
directories, public/private DNS and shared networking, Terraform backends, demos,
Azure DevOps and SWAs remain under separate holds. This is not a backup program.

### First bulk execution: partial progress and resumable NotFound correction

David executed the batch and provided its local report from
`legacy-subscription-cleanup-20261012T233553Z-7947c3d8/report.json`.
Codex inspected that report locally, not through Azure. It records **28 resources
deleted and verified absent**, followed by a stop while checking
`id-award-integrity-check-extension-sandbox`. That record is `Checking`, not
`Deleted`, and the provider error code was `NotFound`. The preceding
`id-award-fraud-analytics-sandbox` is recorded successfully deleted; it was not
the failing deletion.

The original existence-check helper accepted ResourceNotFound variants but
not generic NotFound. The correction handles generic NotFound only after a
successful fresh source inventory also omits the exact resource ID. If the ID
is still listed, or the inventory/authentication read fails, execution stops
rather than claiming deletion. No keep list, target scope, or deletion allowlist
was broadened. Offline regression tests cover disappearance after initial
inventory, generic NotFound after deletion, and a false NotFound for a
still-listed resource. Permission errors remain failures.

David subsequently reran the corrected script. The completed local report
identified above confirms every explicit first-batch target absent, with 40
source entries remaining. The original partial report remains intact. Do not
rerun the historical one-resource slices to recreate or delete the same
resources individually.

## Fresh inventory received and deletion progress

David supplied a successful post-directory-change resource inventory on
October 12. Local parsing verified all 105 resource IDs belong to source
subscription `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca`; none is a target resource.
The inventory contains resources in 11 groups:

| Group | Listed resource entries |
| --- | ---: |
| `rg_award_nomination_sandbox` | 69 |
| `rg_corporate` | 14 |
| `rg_platform` | 7 |
| `NetworkWatcherRG` | 4 |
| `rg_awards_dashboard` | 2 |
| `ME_cae-award-primary-sandbox_rg_award_nomination_sandbox_eastus2` | 2 |
| `ME_cae-award-secondary-sandbox_rg_award_nomination_sandbox_westus2` | 2 |
| `MA_awards-monitor-workspace_eastus_managed` | 2 |
| `AZ-305` | 1 |
| `hub-spoke-demo` | 1 |
| `VisualStudioOnline-5178950BF95D45E19C74B9B72F54A55E` | 1 |

These are ARM resource entries, including some child resources, not 105
independent billable services. This export establishes identity/existence,
not current application traffic, data reconciliation, costs, or delete success.
The registration and source authoritative DNS zone are still listed.
SQL server deletion is operator-confirmed below. The subsequent bulk report
confirms the compute batch completed; 40 resource entries remain.
Inventory counts in this table are the initial snapshot,
not the current remaining resource count.

### Slice 1: David's explicitly disposable old SQL server

The exact server in the fresh inventory is:

```text
/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.Sql/servers/david64-sql-sandbox
```

Its listed database children are `master` and `AwardNominationsSandbox`.
David already explicitly designated this server for deletion and waived its
backup. The documented replacement is the different server
`sql-integritysentinel-sandbox` in the target subscription. Retiring this source
server also retires the old Award database and will break any old source app
still using it; do not interpret that as a reason to delete the target database.

After freezing legacy applies/deployments, David runs this destructive command
only for the already-approved source SQL retirement:

```powershell
az sql server delete --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_award_nomination_sandbox --name david64-sql-sandbox
```

This deletes the source server and its databases. It does not delete the whole
group, the target SQL server, registration/DNS, or unrelated source resources.
No automatic confirmation flag or asynchronous no-wait flag is supplied.
Do not assume recoverability; source backups were waived.

Then verify absence:

```powershell
az sql server show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_award_nomination_sandbox --name david64-sql-sandbox --query id -o tsv
```

`ResourceNotFound` after successful deletion is expected. Authorization,
wrong-tenant, lock, or other errors do not prove deletion. Supply the result
before marking this slice completed. If the service reports soft-delete
protection, a lock, or a dependency, inspect that specific error instead of
automatically purging/removing protections. The old SQL private endpoint remains
an individual later cleanup item; do not delete its NIC independently.

David subsequently reported that this SQL deletion worked. Record slice 1 as
operator-confirmed complete; Codex did not independently query Azure. Do not
infer that the SQL private endpoint or other source resources were also removed.

### Slice 2: the deleted source SQL server's private endpoint

The fresh inventory lists this exact endpoint:

```text
/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.Network/privateEndpoints/pe-david64-sql-sandbox
```

Before deletion, David checks that all its service-connection IDs refer only
to the deleted source SQL server above, not a target resource or another service:

```powershell
az network private-endpoint show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_award_nomination_sandbox --name pe-david64-sql-sandbox --query "{Connections:privateLinkServiceConnections[].privateLinkServiceId,ManualConnections:manualPrivateLinkServiceConnections[].privateLinkServiceId}" -o json
```

If the check confirms the deleted source server is its sole connection target,
David removes that endpoint only:

```powershell
az network private-endpoint delete --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_award_nomination_sandbox --name pe-david64-sql-sandbox
```

Verify absence with the same `show` command. `ResourceNotFound` establishes
absence; an authentication or other error does not. If the endpoint is already
absent, skip deletion. If a connection points elsewhere or the result is unclear,
stop and provide that result. Do not delete the linked NIC independently, the
shared private SQL DNS zone, either VNet, or public domain DNS. Leave managed NIC
lifecycle to the endpoint operation; investigate any leftover NIC separately.
This endpoint is now verified absent by the completed first bulk batch.

Other resources stay under the individual holds below. In particular, a fresh
inventory does not establish that the source SWAs/apex aliases, customer identity
directories, payroll callback, historical Blob links or queues are dispensable.

## Preserve: not part of this cleanup

- The source subscription itself, its billing/renewal arrangements, and its
  administrative access while it holds the registration.
- `rg_platform/terian-services.com`, type
  `Microsoft.DomainRegistration/domains`: the existing domain registration.
  Verify it is still Active with auto-renew enabled after the failed move.
- `rg_platform/terian-services.com`, type `Microsoft.Network/dnszones`: the
  authoritative zone on the four `ns*-04` Azure DNS servers, including mail
  records and website routing. The target zone on `ns*-08` is not yet confirmed
  authoritative. Moving/deleting a zone is not moving a registration.
- Every resource in target subscription `2bb69129-5e74-44d9-af68-96d45633f667`.
- Existing Cloudflare records and delegated Integrity Sentinel DNS. No
  Cloudflare deletion/provider operation is authorized by this cleanup.

Do not delete all of `rg_platform`. Registration and authoritative DNS share
that group with old application, identity-directory, and state resources.

## Cost-first candidate list and individual holds

This list has been checked against David's fresh 105-entry source inventory;
Codex did not obtain it through a live Azure query. A candidate is not a
confirmation that its dependencies are retired.
Before each deletion, verify the exact source resource ID and its applicable
hold. Do not infer readiness from a matching name or a successful homepage load.

| Resource/group | Intended disposition | Hold before deletion |
| --- | --- | --- |
| `rg_award_nomination_sandbox/david64-sql-sandbox` and its databases | First explicitly approved retirement candidate; David already declared it disposable and waived SQL backups | Confirm the source ID and that surviving target workflows use the new SQL server, not this one |
| Source Terian backend, OpenAI, ACR, and Container Apps environment in `rg_corporate` | Included in the approved bulk retirement | David confirmed all old application compute is disposable; stop if an unreviewed/recreated source consumer appears; old frontend bundles/API routes can fail until pointed to target |
| Source Award apps/jobs, Front Door/WAF, OpenAI, ACR and environments in `rg_award_nomination_sandbox` | Included in the approved bulk retirement; SQL already operator-confirmed deleted | Payroll-broker, auxiliary/integrity and jobs were explicitly confirmed recreated in target; source endpoints are deliberately retired; shared data networking is still held |
| All three remaining source SWAs | Approved in the nine-target second batch | David explicitly requested removal; source-hostname failure is accepted. DNS repairs are separate, not automated |
| `rg_corporate/terian-services-cosmos-db` | Approved in the second batch | David confirmed data copying complete; no further reconciliation or backup hold |
| The four source storage accounts selected by the second batch | All four are confirmed absent by the completed data-batch report | Keep legacy deployment/apply workflows frozen; target accounts are never selected |
| Application Insights, Log Analytics, monitoring dashboards/alerts | Included with the approved source workload retirement | Source historical retention is not newly required under the backup waiver; target monitoring resources are never selected |
| Key Vaults and managed identities | Included after the approved old applications/jobs are removed | Stop if a source application survives/reappears; no purges or target secret/identity deletions are performed |
| Service Bus `sb-award-sandbox` | Explicitly approved in the network/messaging batch | David requested namespace deletion; remaining queues/topics/messages are disposable, not replayed; target namespace is excluded |
| Five source Award private DNS zones, ten VNet links and both VNets | Explicitly approved in the network/messaging batch | Reject unreviewed/cross-target links, surviving endpoints, occupied subnets or recreated consumers; public DNS is excluded |
| `Microsoft.AzureActiveDirectory/ciamDirectories` resources, including acmenoms, RideshareDavid64 and syntheticawards | Hold for identity-owner review | These are identity-directory resources, not ordinary disposable compute. Customer sign-in may still depend on their tenants/billing linkage |
| `AZ-305`, `hub-spoke-demo`, `rg_awards_dashboard`, Azure DevOps account and other groups | Review individually, then delete confirmed-disposable resources | Migration evidence does not establish their dependencies or data retention. Recovery Services vault contents and Azure DevOps ownership need individual review |
| `ME_*`, `MA_*` and NetworkWatcher resources | Handle after parent-workload retirement | Review managedBy/parent dependencies; do not independently tear down managed infrastructure while its parent survives |

No whole resource group is currently classified as unconditionally safe to
delete from the supplied evidence. Mixed groups contain protected registration,
identity directories, or data/messaging holds. Once the hold list is empty for
a particular group, David may delete that explicitly reviewed group.

## David-run inventory refresh when needed

Connect to the Terianix Platform tenant. Both subscriptions now share it;
there is no reason to log in to the original tenant for source Azure resources.
Each command explicitly selects the old subscription to avoid confusing the
two subscriptions named "Azure subscription 1".

```powershell
az account show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --query "{Subscription:id,Tenant:tenantId}" -o json

az resource list --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --query "[].{Id:id,Name:name,Type:type,ResourceGroup:resourceGroup}" -o json

az group list --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --query "[].{Name:name,ManagedBy:managedBy}" -o table
```

The resource inventory above has been received; do not repeat it before the
first SQL slice merely to obtain the same list. Refresh after deletions or when
reviewing new resources/dependencies. Only delete
from the reviewed allowlist, never from "everything except these names".
Use source-scoped portal deletion or individual Azure CLI resource deletion;
do not enumerate all resources and pipe them into a delete loop. Review locks
individually, and never remove protection from the registration as part of a
bulk cleanup.

## Execution order after exact-ID review

1. Freeze legacy deployment/apply workflows so they cannot recreate resources
   or modify DNS. Do not disable the target resource-specific workflows.
2. Verify target application/database/API routing for the slice being retired.
   Establish a source write freeze before the final data comparison.
3. Retire David's explicitly disposable source SQL server once its identity and
   nondependency checks pass. Confirm completion before proceeding.
4. Delete confirmed-retired compute and ingress, then their unused environments,
   networking, registries, OpenAI, monitoring, secrets and identities. Handle
   source SWAs only after checking all required hostnames/aliases.
5. Resolve data, signed-link and messaging holds. Then delete old Cosmos/storage
   and message infrastructure; do not invent a discard decision.
6. Review identity directories, old Terraform backends, demos and Azure DevOps
   separately. Remove groups only when their entire contents are reviewed.
7. Confirm surviving websites, sign-in, email and target backend functions, and
   review the remaining source inventory/costs. Report actual deletions; do not
   report requested/submitted deletion as completed.
8. Keep the registration and authoritative DNS in the old subscription until
   their separate migration is resumed and verified. Do not cancel it.

Do not run `terraform destroy` on the old root: its scope includes live DNS and
Cloudflare ownership. Do not apply the temporary source validation root with
its unchanged original-tenant provider configuration after directory change.
Deleting old resources manually also leaves stale Terraform state; freeze and
retire that ownership deliberately rather than applying it to repair drift.

Deletion removes source rollback options. Resource-group deletion is
irreversible; possible resource-specific soft recovery is not a guaranteed
backup. David has waived source backups, but required target functionality and
the existing domain's ownership remain protected.

References:

- [Resource/group deletion and dependencies](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/delete-resource-group).
- [SQL server deletion command](https://learn.microsoft.com/en-us/cli/azure/sql/server?view=azure-cli-latest#az-sql-server-delete).
- [Private endpoint deletion command](https://learn.microsoft.com/en-us/cli/azure/network/private-endpoint?view=azure-cli-latest#az-network-private-endpoint-delete).
- [Domain cancellation releases ownership](https://learn.microsoft.com/en-us/azure/app-service/manage-custom-dns-buy-domain#cancel-the-purchase).
- [Initial data copy and remaining reconciliation](../terraform_terianix_platform/docs/STEP_5_DATA_MIGRATION.md).
- [Deferred registration relocation](moving_terian_services_com_app_service_domain_to_new_subscription.md).
- [DNS cutover and protected applications](../terraform_terianix_platform/docs/STEP_8_DOMAIN_CUTOVER.md).
