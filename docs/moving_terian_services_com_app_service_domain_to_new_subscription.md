# Moving terian-services.com App Service Domain to the new subscription

Updated: October 12, 2026 (America/Los_Angeles).

## Latest execution update: registration work deferred

David completed the source subscription's directory reassociation into
Terianix Platform and restored/confirmed Owner access to both subscriptions.
The subscriptions now share tenant `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`.
The actual App Service Domain move failed with `ProviderMoveNotificationFailed`,
inner `BadRequest`, extended code `59743`: target subscription not eligible to
create an App Service Domain. Target checks show `PayAsYouGo_2014-09-01`, Enabled,
spending limit Off, and Microsoft.DomainRegistration Registered. The remaining
eligibility restriction is not known; support submission is not confirmed.
Latest move correlation ID: `e9e7482d-e484-4281-8971-fb93b2e19fb0`.

David now defers the registration move and prioritizes deleting source resources
that are no longer needed. Preserve the existing registration and authoritative
source DNS, and keep the subscription active while they remain there. No
resource deletion, domain relocation, or DNS-delegation switch is confirmed.
See [Legacy subscription cleanup](retiring_legacy_subscription_resources.md).
The planning/pre-transfer status below is historical and is superseded by this
execution update. Codex performs no live Azure or Terraform operations.

## Earlier approved plan

Status: Azure-retained relocation selected by David on October 12, 2026.
The source subscription's directory reassociation is approved. David will
perform the domain move, Terraform adoption, and DNS/renewal verification.
Execution is still pending eligibility/access checks, directory reassociation,
and domain-only move validation. The stale DNS-link diagnosis is complete;
source repair is deferred unless validation requires it.
David performs all live Azure, Terraform, and registrar operations. Codex has
only inspected local files and public documentation.

## Decisions recorded on October 12

- **Registration route:** keep registration in Azure and relocate the existing
  App Service Domain to the target subscription. Cloudflare transfer is not
  the selected route; terianix.ai's existing Cloudflare setup stays unchanged.
- **Directory reassociation:** David explicitly reconfirmed that the change may
  affect the entire source subscription, including groups outside rg_platform.
  Approved subject to Azure's eligibility/access prerequisites. The target
  directory is unchanged; the later resource move initially selects the domain only.
- **Old SQL server:** David confirmed david64-sql-sandbox is destined for
  deletion, not preservation or migration through this directory change.
  No SQL backup/restoration work is required here. Actual deletion has not been
  reported complete; any transfer restriction while it still exists must be
  addressed through the reviewed retirement/eligibility process, not rebuilding it.
- **Source backups:** waived by David because the source is destined for deletion.
  No source workload/state backup or restoration programme is required by this
  plan. This accepts loss of source recovery options; it does not waive remaining
  data-migration checks or protect the domain by itself.
- **Remaining checks:** retain only inventory/eligibility checks needed to
  perform the reassociation, preserve control of registration/DNS, and verify
  that nothing still needed is deleted. Do not recreate retired source workload
  identities just to preserve their old functionality.
- **DNS-link/dependencies:** the stale link is confirmed. Codex prepares the
  operator procedure; David runs live validation/corrections. Repair the source
  link only if move validation requires it; otherwise handle target DNS management
  after moving. No successful move validation has yet been confirmed.
- **Move/adoption/delegation:** David will execute the reviewed domain move,
  import target Terraform ownership, and verify DNS, renewal, and applications.
- **Final retirement:** broader migration gates still apply. Approval of the
  route is not evidence that these activities are complete.

## Outcome and current blocker

Keep the existing domain registration continuously owned and move its Azure
resource from the old subscription to `rg_terianix_platform` in the Terianix
Platform subscription. This is a resource relocation, not cancellation,
re-purchase, or an EPP transfer to another registrar.

Microsoft lists `Microsoft.DomainRegistration/domains` as supporting resource
group and subscription moves. Ordinary cross-subscription resource moves
require both subscriptions to belong to the same Microsoft Entra tenant.
[Supported resource types](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-support-resources#microsoftdomainregistration),
[move prerequisites](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-resource-group-and-subscription#checklist-before-moving-resources).

David's October 12 `az account show` results confirm different tenants:

| Item | Source | Target |
| --- | --- | --- |
| Subscription | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` | `2bb69129-5e74-44d9-af68-96d45633f667` |
| Tenant | `4d5f34d3-d97b-40c7-8704-edff856d3654` | `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` |
| Registration resource group | `rg_platform` | Proposed: `rg_terianix_platform` |

**Direct move is blocked as configured.** Changing Terraform providers, adding
an import block, or having access to both tenants does not remove this prerequisite.

The selected standard route is:

1. Review and approve the impact on the remaining source subscription.
2. Associate the **source subscription** with the target tenant, if eligible.
3. Restore necessary administrative access and validate the precise domain move.
4. Move the existing registration and any explicitly required dependencies.
5. Reconcile DNS, renewal/billing, and target Terraform ownership.
6. Retire the source subscription only after the wider migration gates pass.

The target subscription's directory is not changed. The source subscription
ID stays the same during directory reassociation; the later resource move
changes the domain resource ID. This would be a temporary migration sequence,
not a permanent two-subscription design. Its directory reassociation is approved,
but no reassociation or resource move has been reported complete.

## Where we stand

These facts come from David's outputs/screenshots and the local repository;
they are not fresh Azure queries by Codex.

- Existing registration: Azure App Service Domain `terian-services.com` in
  source `rg_platform`. Last supplied metadata: Active, auto-renew enabled,
  privacy enabled, expiration January 26, 2027. Reconfirm before moving.
- Existing authoritative DNS: source `rg_platform/terian-services.com`,
  with `ns1-04.azure-dns.com`, `ns2-04.azure-dns.net`,
  `ns3-04.azure-dns.org`, and `ns4-04.azure-dns.info`.
  David's October 12 portal screenshot shows 19 record sets; the resolver
  response still identifies the old zone's SOA.
- Prepared target DNS: `rg_terianix_platform/terian-services.com`,
  with the corresponding four `ns*-08` servers and 12 record sets.
  It is not yet authoritative. The seven-record count difference is consistent
  with the intentionally excluded Award/demo/synthetics records, but counts
  alone are not a record-by-record readiness check.
- `www.terian-services.com` publicly resolves to target
  `calm-plant-0158e0a0f.5.azurestaticapps.net`. The target SWA binding is Ready
  using CNAME validation. This does not move registration or DNS authority.
- The `terian-services.com` apex's current target binding/routing readiness
  needs separate confirmation.
- David's fresh registration read confirms `dnsZoneId` still references
  `rg_award_nomination/terian-services.com`. The exact linked-zone query returned
  `ResourceGroupNotFound` for `rg_award_nomination`. The actual source zone in
  `rg_platform` exists with 19 record sets and matching ns*-04 nameservers.
  The App Service Domain's Manage DNS records action displays delegation setup,
  not that existing zone. Source-link repair is not a prerequisite unless move
  validation rejects the stale reference. Do not assume moving repairs it.
- Neither the legacy Terian production root nor the target root currently
  defines an App Service Domain registration resource. Its existing Terraform
  ownership, if any, must be identified before adoption.
- The shared target resource group is owned by the Integrity Sentinel
  platform state and is a data source in this project's target root.
  Do not adopt or recreate that resource group here.

Source registration ID:

```text
/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.DomainRegistration/domains/terian-services.com
```

Proposed destination ID, **only after a successful supported move**:

```text
/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terianix_platform/providers/Microsoft.DomainRegistration/domains/terian-services.com
```

## Gate 1: implement the approved directory reassociation

The directory reassociation affects the whole source subscription, not just
this domain. David has waived source backups and source workload restoration.
Do not export source state/data/roles as a backup requirement.
Review the remaining inventory only for transfer eligibility, administrative
access, domain/DNS control, and remaining dependencies on data or workloads.
Do not paste credentials, registration contacts, or state into the chat.

Known impact areas include:

- Subscription RBAC assignments/custom roles are removed. Restore only the
  administrative access required to manage the remaining domain/DNS and move.
- Existing managed identities can break. Recreate only identities still needed
  for an explicitly retained workload or dependency; not every retiring identity.
- Key Vault tenant/access settings and storage ACLs can be impacted; check any
  that remain necessary rather than restoring the whole source environment.
- Some configurations are unsupported, including Azure SQL with Entra
  authentication; subscription-offer restrictions also matter. Microsoft
  states that directory changes are not supported for CSP subscriptions.

Verify the billing/Owner prerequisites and access in both directories. Lost
RBAC is not automatically restored by switching a directory back. Accepted
website outage does not make loss of data, keys, or administrative access
acceptable.
[Directory-transfer prerequisites and impacts](https://learn.microsoft.com/en-us/azure/role-based-access-control/transfer-subscription).

Prefer completing or safely isolating remaining workload migrations before
considering this subscription-wide step. Do not assume the initial data copy
or successful www routing proves the rest of the subscription is disposable.

**Approval recorded:** David selected this route and approved directory
reassociation. Offer eligibility, necessary Owner/billing access, and remaining
transfer blockers still need operator confirmation. If Azure blocks the
reassociation, report the exact restriction; do not try domain cancellation
or a guessed cross-tenant resource move.

The [Cloudflare document](moving_terian_services_com_domain_registration_from_azure_to_cloudflare.md)
is retained as an unselected historical alternative, not an active transfer plan.

## Gate 2: validate the domain-only move, not the old environment

Before any move:

- Confirm registration/renewal health, contact access, and the current
  `dnsZoneId`. Do not disable renewal or privacy as a speculative fix.
- Check destination eligibility, provider registration, permissions, quotas,
  and locks through the documented move-validation process.
- Decide whether validation permits moving the domain alone or requires DNS
  dependencies to accompany it. Do not infer the dependency set from the
  resource type's general move-support entry.
- Submit the initial validation for the registration resource alone, after
  tenant alignment. The stale source DNS link has not been proven to block it.
  Fix that link only if required by validation or later target DNS management;
  do not write a guessed cross-tenant `dnsZoneId`.

**Collision:** a target DNS zone with the same name already exists in the
proposed destination resource group and is Terraform-managed. Do not bundle
the old DNS zone into a move to that same location, overwrite the prepared
zone, or remove its deletion protection to make the move fit.

If the old authoritative zone must move with the domain, design and validate
its distinct landing location and subsequent Terraform ownership separately.
No landing group or DNS-state handoff has been approved or created.

## Gate 3: validate and execute the resource move

Move validation can proceed once both subscriptions are confirmed in the same
tenant and eligibility/access checks pass. The actual move requires successful
validation of the exact request and resolution of any reported dependencies.

David runs the documented move validation for the exact registration resource,
destination resource group, and confirmed dependencies. Review any validation
failure before attempting the move. Do not select all resources in `rg_platform`
or treat validation of one resource as permission to move the entire group.

Save before/after IDs and operation evidence privately. After the approved
move, verify the domain is manageable from the target subscription, still
registered, and has correct renewal/billing and DNS-link settings. Resource
IDs and scoped role assignments require reconciliation after resource moves.
[Resource move procedure](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-resource-group-and-subscription).

Route/directory approval and DNS-link diagnosis are now recorded. Eligibility
checks and successful move validation are still outstanding. David executes the
directory reassociation and actual move; Codex does not run them.

## Gate 4: adopt the moved registration into target Terraform

After the move, prepare an import-first registration definition in
`terraform_terianix_platform/environments/prod` using a verified provider/API
that supports the existing registration and required settings.

- Import the actual new resource ID; do not create or purchase a second domain.
- Preserve renewal, registration, and contact settings; add deletion protection.
- Coordinate any previous state's ownership with its owner and freeze stale
  applies. Terraform import does not perform the Azure resource move.
- Generate a fresh target plan. Stop if it proposes registration replacement,
  purchase, cancellation, or unexpected DNS changes.
- Keep contacts, credentials, state, and any transfer authorization codes private.

No registration Terraform resource or import block has been added yet.
Changing the source subscription's directory would also invalidate the fixed
source-tenant assumption in the temporary `source-domain-validation` helper.
Do not reapply that helper unchanged or alter its tenant as an unreviewed shortcut.

## Gate 5: choose and verify authoritative DNS

Registration relocation and DNS delegation are separate checkpoints.
Moving the registration alone is not evidence that ns*-08 became authoritative.

If the prepared target zone is chosen, first compare its retained records
against the authoritative source, including website/apex, mail MX/SPF/DKIM/DMARC,
verification, and any required delegations. Then use a supported registrar
procedure to delegate all four target nameservers. Do not attempt to accomplish
this by editing the old zone's SOA or its built-in NS records.

Keep source DNS while registrar/parent delegation or caches still depend on it.
Retirement requires verification of parent delegation, public answers, target
website/TLS/backend/email, and the selected DNS design—not just a changed SOA
in one cached resolver response.

Protected Cloudflare Award hostnames, `is.terianix.ai` delegation, and
`sandbox.is.terianix.ai` are outside this domain-registration move. Do not
change them or introduce a Cloudflare Terraform provider.
Detailed checks are in the [Step 8 runbook](../terraform_terianix_platform/docs/STEP_8_DOMAIN_CUTOVER.md).

## Focused sequence: start with minimum eligibility/access checks

Tenant confirmation and source DNS-link diagnosis are complete. Do not repeat
the domain/zone queries below as prerequisites; they are retained as evidence.
The source registration stays Active with auto-renew enabled.

The agreed sequence is:

1. Check only directory-transfer eligibility and the acting account's access.
2. David performs the already-approved source directory reassociation.
3. Reauthenticate and confirm matching tenant IDs.
4. Validate moving the App Service Domain alone.
5. Resolve only the dependencies/errors Azure actually reports, move the
   registration, then complete target Terraform/DNS/renewal work.

### Step 1: remaining inventory and account access

David has supplied the full read-only source inventory. The command below is
retained for reference; do not repeat it just to reconfirm the scope:

```powershell
az resource list --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --query "[].{Name:name,Type:type,ResourceGroup:resourceGroup}" -o table
```

Review only known transfer blockers and still-required dependencies. The supplied
inventory contains the retiring david64-sql-sandbox server, CIAM resources,
source corporate/Award workloads, and the registration/DNS in rg_platform.
SQL is not a preservation requirement. Its presence alone does not prove Entra
authentication is enabled, but planned deletion does not establish that an
existing unsupported configuration has already been removed. Address only actual
eligibility restrictions; do not restore the source environment as a prerequisite.

In Azure Portal, open **Subscriptions → source subscription
`4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` → Access control (IAM) → View my access**.
Confirm the acting account has a direct, unconditional subscription Owner role;
being Global Administrator of a tenant alone is not subscription Owner.
Check the subscription offer/billing requirements as well.

Open **Change directory** for that source subscription and check whether
**Terianix Platform**, tenant `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`, is
available. Inspect the selector/warnings without submitting while the minimum
checks are pending. The acting account must exist in both directories; two
separate admin logins, one in each tenant, do not by themselves establish this.
If the target is absent or the offer is restricted, report that specific blocker.

[Directory-association procedure and prerequisites](https://learn.microsoft.com/en-us/entra/fundamentals/how-subscriptions-associated-directory).

### Step 2: approved directory reassociation

After Step 1 passes, David selects the **target tenant**, not the target
subscription, in the source subscription's Change directory panel and confirms
the already-approved change. This retains the source subscription ID and does
not transfer subscription billing ownership.

Old subscription RBAC/identities are impacted. Restore only the administrative
access needed to manage/move the remaining registration and DNS. Do not restore
retired source workloads or run the old Terraform/helper roots during this
transition. The target subscription's directory/configuration stays unchanged.

Switch to the target directory in the portal, reauthenticate Azure CLI, and
refresh its subscription inventory before checking tenant IDs:

```powershell
az login --tenant 5979eb86-9af1-4c74-8e50-acbe7d6a5cf9
az account list --refresh --query "[].{Subscription:id,Tenant:tenantId,State:state}" -o table
az account show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --query "{Subscription:id,Tenant:tenantId}" -o json
az account show --subscription 2bb69129-5e74-44d9-af68-96d45633f667 --query "{Subscription:id,Tenant:tenantId}" -o json
```

Both tenant values must be `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`. A
successful login or stale cached account entry is not proof the reassociation
completed. Check portal subscription filters/sign-in if the source is not visible.
Do not run move validation until domain/destination administrative access works.

### Completed DNS diagnosis: evidence only

These commands are read-only, produce no backup files, and are for David to
run after authenticating to the source tenant. The domain query excludes
contact/credential data:

```powershell
az resource show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_platform --resource-type Microsoft.DomainRegistration/domains --name terian-services.com --query "{Id:id,Status:properties.registrationStatus,AutoRenew:properties.autoRenew,DnsType:properties.dnsType,DnsZoneId:properties.dnsZoneId,NameServers:properties.nameServers}" -o json

az network dns zone show --subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca --resource-group rg_platform --name terian-services.com --query "{Id:id,NameServers:nameServers,RecordSets:numberOfRecordSets}" -o json
```

Interpretation:

1. Compare the registration's `DnsZoneId` with the actual source zone `Id`.
   Comparison is case-insensitive. Matching ns*-04 nameservers with a mismatched
   resource ID means working public delegation does not establish a healthy
   management link.
2. If the link points elsewhere, inspect that exact linked resource using
   `az resource show`. Only a confirmed not-found result establishes a missing
   link; an authorization error establishes an access issue, not absence.
3. Do not PATCH `dnsZoneId` speculatively, recreate the registration, create the
   missing historical zone, or point the source registration across tenants.
   The generic API property's presence does not establish a supported relink
   procedure for this existing registration. Review the actual response and
   available App Service Domain DNS-management controls before selecting repair.
4. Retain the current working source delegation. Do not repair the source
   merely for tidiness: attempt domain-only move validation once tenants align.
   If validation reports the missing DNS association as a blocker, address that
   exact error using a verified supported repair or Microsoft support. Otherwise
   reconcile DNS management/delegation after the registration moves.

## Step 3: domain-only move validation after tenant alignment

1. David uses the source subscription's **Change directory** process to select
   tenant `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`. Do not change the target
   subscription or assume the change has completed merely because it was approved.
2. Reauthenticate and recheck both subscription tenant IDs. They must match
   the target tenant. Ensure David has administrative access to the source domain
   and destination group before continuing.
3. In source `rg_platform`, select **only the App Service Domain registration**.
   Use **Move to another subscription**, target subscription
   `2bb69129-5e74-44d9-af68-96d45633f667`, group `rg_terianix_platform`, and
   run validation. Do not select the source zone or all source resources.
4. Review validation before the final Move action. If it identifies required
   DNS/dependencies, collect their exact IDs and resolve the target-zone collision
   before extending the request. A pending/accepted validation is not success.
   Azure's final validation result determines the exact dependency set.
5. When validation passes for the reviewed request, David executes the domain
   move, verifies renewal/management access, then proceeds with Terraform adoption
   and the DNS-delegation gate above.

The validation API is `validateMoveResources`, not `moveResources`. Validation
tests a request without executing the resource move. A REST `202` only means
accepted; follow its operation result to final success or failure.
[Validate-move API](https://learn.microsoft.com/en-us/rest/api/resources/resources/validate-move-resources?view=rest-resources-2021-04-01).

## Checklist: decisions versus completed operations

- [x] Select Azure-retained relocation.
- [x] Approve source subscription directory reassociation.
- [x] Reconfirm the directory change affects the whole source subscription, not only rg_platform.
- [x] Receive source inventory and record old SQL as retiring, not a preservation requirement.
- [x] Record source backups as waived.
- [x] Agree David will execute the domain move, Terraform adoption, and DNS checks.
- [ ] Confirm minimum inventory, offer eligibility, and administrative access.
- [x] Diagnose the stale source DNS link and confirm the working source zone exists.
- [ ] Repair DNS linkage only if move validation or target DNS management requires it.
- [ ] Complete directory reassociation and reconfirm matching tenants.
- [ ] Validate the exact move request and resolve any dependency/zone collision.
- [ ] Execute and verify the domain move.
- [ ] Import target Terraform ownership and review a safe plan.
- [ ] Complete chosen DNS delegation, renewal, and end-to-end verification.
- [ ] Resolve all other migration gates before old subscription retirement.

Do not cancel/delete the App Service Domain, release the domain, cancel the
source subscription, or destroy mail-bearing DNS as a shortcut.
See the [overall migration](migrating_to_terianix_platform.md) for the broader
data, workload, state, and retirement requirements.
