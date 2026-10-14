# Step 8: Custom domains and authoritative DNS

**October 13 identity update:** David reports the legacy tenant deletions done
except Rideshare David64 Organization, which is retained. Rename to
`Terian Services Inc.` and guest access for `david.admin@terianix.onmicrosoft.com`
are pending operator changes. This supersedes all-three tenant deletion approval
below. Directory retention/renaming does not transfer the App Service Domain,
change DNS, or establish absence of the deleted tenants' Azure billing resources.

**Latest cleanup update:** the completed operator network-batch report
`legacy-subscription-cleanup-20261013T035850Z-6d9d3007/report.json` verifies all
18 explicit targets absent: five Award private DNS zones, ten VNet links,
Service Bus and both VNets. Twelve source entries remain. The earlier data batch
is also complete. David now approves retirement of the three legacy CIAM tenants;
Entra tenant deletion checks and exact directory identification are pending.
No tenant deletion was performed by Codex. Both public DNS zones and the domain
registration remain retained; registration relocation remains deferred.
Earlier partial data/network-batch statuses below are historical.

**Latest execution update, October 12:** the old subscription's directory
reassociation completed and David confirmed Owner access to both subscriptions.
The domain registration move failed during execution with eligibility error
59743; target Pay-As-You-Go/Enabled/spending-limit-Off/provider-Registered checks
did not explain the rejection. David defers registration work and prioritizes
cleanup of confirmed-retired source resources. Preserve registration and the
authoritative source DNS zone. SQL deletion is operator-confirmed; the first
bulk run stopped after 28 verified deletions on a generic NotFound identity
lookup. The corrected operator rerun completed: all explicit compute targets
were verified absent and its local report lists 40 remaining source entries.
Full subscription retirement is not complete.
See [Cost-first legacy cleanup](../../docs/retiring_legacy_subscription_resources.md).
David later confirmed all old application compute is disposable and recreated
in target. The cleanup runbook provides a single guarded operator batch; Codex
tested it offline only. The first compute batch is completed. David then
confirmed data copying complete and requested all legacy Cosmos DB, SWAs and
storage accounts removed. The separate nine-target data batch was executed but
stopped partially: the Award SWA was verified absent; Terianix SWA deletion
returned success but its lookup/inventory disagreed. Remaining targets were
not reached. Bounded verification retries are prepared, not confirmed run.
The subsequent rerun verified the Services SWA, storage endpoint and Cosmos
account absent, then failed deleting `az305storage1964`. Portal deletion also
failed; the precise Azure error is pending Activity log inspection. Storage
account retirement is not confirmed. No locks or retention settings are changed.
The matching failed Activity log event reports HTTP 409
`AccountProtectedFromDeletion`; the storage protection policy still needs
inspection before selecting a supported cleanup route.
David subsequently confirmed `az305storage1964` deleted following manual
container/version cleanup. That blocker is cleared. The other three storage
accounts remain pending in the same resumable batch; registration and DNS are
not selected for deletion.
The batch selects three SWAs, one Cosmos account, four
storage accounts and the Award storage endpoint. Source data/state/storage
queues are disposable, and remaining source-only hostnames may fail until DNS
is corrected. Registration/DNS, identity directories and other unselected
resources remain protected. No DNS changes are automated by either batch.
Earlier pending-directory and cross-tenant statements below are historical.

**Earlier decision, October 12:** retain Azure registration and relocate the
App Service Domain to the target subscription. David approved reassociation
of the source subscription's directory and waived source backups.
David's account outputs confirm the subscriptions are still in different tenants.
The selected route and historical alternative are documented here:

- [Moving the App Service Domain to the new Azure subscription](../../docs/moving_terian_services_com_app_service_domain_to_new_subscription.md).
- [Moving terian-services.com registration from Azure to Cloudflare](../../docs/moving_terian_services_com_domain_registration_from_azure_to_cloudflare.md).

Directory reassociation and domain relocation are approved operator work,
not completed operations. The stale source DNS link is diagnosed; source
repair is deferred unless move validation requires it. Minimum eligibility/access,
directory reassociation, and domain-only move validation remain pending.
Do not change the target subscription's directory, cancel the
registration, or transfer it to Cloudflare. Codex does not run live operations.
Successful website cutovers do not establish domain/DNS migration completion.
Older decision statements later in this document are historical and do not
override this status.

## Latest operator-confirmed www cutovers

David manually completed these changes; Codex did not query or change Azure,
DNS, Cloudflare, or live Terraform state:

- `www.terianix.ai`: the regenerated TXT token validated only after David
  changed its Cloudflare record name from `_dnsauth.www` to `www`. The `www`
  CNAME was then changed to `zealous-rock-0c92ed20f.2.azurestaticapps.net`,
  DNS-only, TTL 300. David confirmed the site worked. The new token is now
  saved in the ignored production `domain-validation.auto.tfvars.json`.
- `www.terian-services.com`: the authoritative source `rg_platform` zone's
  CNAME already points to `calm-plant-0158e0a0f.5.azurestaticapps.net`, TTL 300.
  David recreated the target SWA binding with CNAME validation. His Azure CLI
  output reports `Ready`, no error, and no validation token, on the expected
  target subscription/app. No temporary TXT record named `www` was created.
- The last generated Terian Services www TXT token was not used: the working
  binding is now CNAME-validated. Do not publish that unused token or remove
  the working CNAME to retry TXT validation.
- `terian-services.com` apex readiness/delegation/registration remain separate
  checks. The source DNS zone is still required; the target shadow zone has
  not been made authoritative by either www cutover.

The target configuration now matches these methods: Terian Services www uses
`cname-delegation`; the other three domains remain `dns-txt-token`. Cloudflare
validation output now describes only TXT `@` and TXT `www`, not the unsuccessful
`_dnsauth.www` recipe. Cloudflare remains manually managed.

### Before the next target Terraform apply

Keep `prevent_destroy` on the working bindings. David's first reconciliation
plan confirmed that AzureRM retained `dns-txt-token` in state and proposed
replacement when configuration changed to `cname-delegation`.

Inspection of the exact AzureRM 3.117.1 source confirms that the Azure read API
does not supply `validation_type`; the provider retains that creation metadata
from state. Its passthrough importer does not reconstruct the actual method,
so forgetting and importing the resource is not a reliable correction.

The binding resource now uses `ignore_changes = [validation_type]` alongside
`prevent_destroy = true`. This applies to that single creation-only field on
the four marketing bindings: new bindings use their configured method, but
later method differences do not replace existing bindings. Domain names and
SWA IDs are still managed normally. Future deliberate method changes on an
existing binding require a separately reviewed revalidation procedure; they
will not be performed by Terraform through this field.

Run a fresh target plan yourself and inspect it before applying. The validation
method alone should no longer propose a resource change. Stop if any working
binding is still replaced or deleted; do not bypass its deletion protection,
delete it in Azure, or apply an older plan. Output-only updates for the saved
token and Cloudflare record names may remain. Codex has not removed, imported,
edited, or pushed live state, and has not verified a live no-change plan.

References: [AzureRM 3.117.1 custom-domain implementation](https://github.com/hashicorp/terraform-provider-azurerm/blob/v3.117.1/internal/services/appservice/static_web_app_custom_domain.go),
[Terraform ignore_changes lifecycle](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle#ignore_changes).

For compatibility with the earlier token saver and temporary source helper,
the saved maps retain the former Terian Services www proof as historical data.
It does not validate the current CNAME binding. The existing Azure
`_dnsauth.www` sets are likewise retained, not renamed to collide with CNAME
`www`. Do not reapply the legacy/source preparation recipes below as a repair
for the now-Ready www domains; their cleanup is a separate reviewed step.

The local reconciliation changes do not alter the source CNAME, name servers,
mail, apex routing, protected Award records, or Integrity Sentinel delegation.

## Historical preparation procedure

Status: preparation only. David performs all Azure, Cloudflare, registrar, and
Terraform operations. No live services were queried or changed to prepare this
runbook. Values below are from local configuration and information supplied by
David; confirm them with fresh exports before using them.

**Current implementation state:** existing Azure shadow DNS and SWA bindings are
managed through Terraform; Azure-retained terian-services.com registration is
selected, with DNS-link/delegation details pending. Terianix.ai stays on manually
managed Cloudflare. No Cloudflare provider
is added to the target root. Permanent deletion of the old subscription is
the final objective; overlap is temporary, not the end state.

**October 10 decision: one maintenance-window cutover.** David explicitly
accepts several hours of outage and wants the full migration in one window,
not a separate source-binding retirement stage or a zero-downtime requirement.
The earlier parallel-validation procedure remains preparation evidence, not
a requirement to wait indefinitely before an approved disruptive cutover.
Codex still does not run Azure operations, live Terraform plans/applies, or
Cloudflare changes; David reviews and executes the cutover.

One window is a coordinated sequence, not an atomic cross-tenant Terraform
transaction. Azure certificate issuance, DNS caching, and registrar transfer
can take longer than several hours. Removing source bindings is not proven
to resolve the pending target validations.

The whole-window execution package is **not ready to run** until the
terian-services.com registrar-delegation procedure in the new Cloudflare runbook
is confirmed and supported. Accepting outage does not authorize releasing a registered domain,
discarding uncopied data, or deleting target Award/Integrity Sentinel resources.
Do not run an unrestricted destroy of the legacy Terraform root: it includes
live Cloudflare records and can remove mail-bearing resources.

Preparation before starting the outage:

1. Resolve registration transfer/ownership and the exact delegation procedure.
   Preserve the App Service Domain resource; deletion is not transfer.
2. Back up source/target state and reviewed DNS exports outside the old
   subscription; obtain a current subscription inventory before teardown.
3. Arrange a source write freeze and final Cosmos/Blob reconciliation, queue
   handling, and historical-link disposition. The create-only copier alone
   does not reconcile changed existing documents.
4. Review the exact combined cutover and deletion targets. Source marketing
   bindings/apps, source DNS, and source corporate services require explicit
   targets; the four new Award domains, Integrity Sentinel delegation, and
   mail records remain protected.

Within the approved window: freeze writes and finish the delta, detach source
marketing bindings, switch website routing and supported Azure delegation,
complete target binding/TLS/configuration work, and verify target frontend,
backend, email, and protected applications. Retire the reviewed source
resources after those checks in that same window where possible.
Old DNS must not be deleted while parent delegation/cached answers still rely
on it. A cache-safe temporary retention is not permanent coexistence.

An ordinary Azure cross-subscription resource move is not a cross-tenant
registration transfer. David rejected subscription-directory changes and
selected Cloudflare Registrar/DNS. This changes the final Azure-DNS design;
the existing shadow-zone resources are not yet removed from Terraform.

References: [Azure move tenant prerequisite](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-resource-group-and-subscription),
[App Service Domain deletion warning](https://learn.microsoft.com/en-us/azure/app-service/manage-custom-dns-buy-domain#cancel-the-purchase),
[Cloudflare transfer prerequisites](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/).

**DNS scope correction:** Award-related records in the legacy
`terian-services.com` zone are excluded from this migration. This is not an
instruction to remove existing Award records under `terianix.ai` in Cloudflare;
the four new-platform Award hostnames listed below are explicitly protected.
Discard the earlier 20-addition plan as a cutover input and generate a new plan.

## Scope and destination

| Website hostname | DNS host after migration | Destination |
| --- | --- | --- |
| `terian-services.com` | Cloudflare, after supported delegation/transfer | Flattened apex CNAME `calm-plant-0158e0a0f.5.azurestaticapps.net` |
| `www.terian-services.com` | Cloudflare | CNAME `calm-plant-0158e0a0f.5.azurestaticapps.net` |
| `terianix.ai` | Existing Cloudflare zone | Flattened apex CNAME `zealous-rock-0c92ed20f.2.azurestaticapps.net` |
| `www.terianix.ai` | Existing Cloudflare zone | CNAME `zealous-rock-0c92ed20f.2.azurestaticapps.net` |

Both target Static Web Apps are in `rg_terian_services_prod`, subscription
`2bb69129-5e74-44d9-af68-96d45633f667`.

**Do not change terianix.ai's name servers or transfer its registration.**
Cloudflare stays authoritative. Its non-authoritative Azure zone is not the
place to make production DNS changes.

### Registration checkpoint: terian-services.com

**Superseded alternative:** retaining Azure registration through a subscription
directory change was considered and rejected. The current choice is a
Cloudflare registration transfer, not deletion/re-purchase. Registration and
source DNS must remain until their handoff gates in the new document pass;
neither subscription's directory is to be changed.

References: [Domain move support](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/move-support-resources#microsoftdomainregistration),
[Subscription directory transfer impact and prerequisites](https://learn.microsoft.com/en-us/azure/role-based-access-control/transfer-subscription).

David supplied the following on October 9, 2026:

- Existing zone: legacy subscription, `rg_platform`, 18 record sets.
- Existing zone and App Service Domain both list
  `ns1-04.azure-dns.com`, `ns2-04.azure-dns.net`,
  `ns3-04.azure-dns.org`, `ns4-04.azure-dns.info`.
- App Service Domain: `rg_platform/terian-services.com`, active,
  auto-renewal enabled, expiration January 26, 2027.
- Registration `dnsZoneId` instead references
  `rg_award_nomination/providers/Microsoft.Network/dnszones/terian-services.com`.

That link differs from the supplied zone ID. It is not proof that public DNS
is broken, but it is a checkpoint before delegation changes. Do not repair it
by guessing a replacement ID, editing zone-apex NS, or deleting either resource.
David also reports that the referenced zone is not visible in
`rg_award_nomination`. A stale registration link is therefore likely, not
confirmed; do not recreate that historical zone to satisfy the link.

App Service Domains use GoDaddy-backed registration and Azure DNS. Confirm in
the App Service Domain controls, or with Microsoft Support, how to re-delegate
this registration to a DNS zone in a **different tenant**. Do not assume an
ordinary registrar name-server editor is available. Updating a resource's
`dnsZoneId` alone is not evidence that parent delegation changed.

If no supported cross-tenant delegation/registration migration is available,
hold subscription deletion and resolve a registrar transfer or supported Azure
relocation. Keeping the existing zone/registration may be a **temporary**
website-cutover fallback, but it does not satisfy the final objective.
No registration update is enabled in Terraform: an unsupported guessed
`dnsZoneId` update across tenants is not a safe implementation.
Keep renewal and deletion protection until registration ownership is migrated.

Reference: [App Service Domain registration and management](https://learn.microsoft.com/en-us/azure/app-service/manage-custom-dns-buy-domain).

## A. Collect evidence before changing anything

From the repository root, **David runs** the following read-only export once
while connected to the source tenant and once while connected to the target:

```powershell
.\scripts\export-terianix-domain-cutover.ps1 -Side Source
.\scripts\export-terianix-domain-cutover.ps1 -Side Target
```

The script does not log in or change subscription context. It saves complete
Azure record-set JSON, including alias target resource IDs, assigned name
servers, frontend default hostnames/slices, custom-domain status, and selected
registration metadata. Each run gets a separate timestamped directory under
`terraform_terianix_platform/domain-cutover-local/`, which is gitignored.

In Cloudflare, open `terianix.ai` -> **DNS -> Records -> Import and Export ->
Export**. Save the zone file in the same private directory. Also capture current
proxy/flattening settings, DNSSEC status, and any redirect rules or Workers
routes affecting apex/www.

Provide the two snapshots and Cloudflare export for local review. DNS exports
can contain verification tokens; do not commit them or share them publicly.
The exporter does not export deployment tokens or contact details.

Reference: [Cloudflare zone export](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/).

Record these additional facts:

- Current TTLs of the four website records, and when they are reduced.
- Parent delegation TTL and any DS/DNSSEC configuration for terian-services.com.
- How App Service Domain delegation will be changed and rolled back.
- Current apex alias target IDs and both old frontend hostnames.
- Exact old Cloudflare apex/www values for rollback.

### Source export reviewed

The source snapshot exported October 9, 2026 was inspected locally:

- Both legacy SWAs are in slice **7**:
  `polite-coast-0fe6ad20f.7.azurestaticapps.net` (Terian Services, `rg_platform`)
  and `delightful-forest-0535e780f.7.azurestaticapps.net` (Terianix, `rg_corporate`).
- All four legacy custom-domain bindings report `Ready` in that snapshot.
- Terian Services apex A alias and www CNAME already have TTL **300 seconds**;
  no TTL reduction is needed for those two records unless subsequently changed.
- The apex alias references the legacy Terian Services SWA; www points to its
  exported default hostname. Preserve these exact rollback destinations.
- The source zone contains 18 record sets. Preserve website, Zoho mail, and
  retained verification records, but deliberately omit Award records.
- Excluded CNAMEs: `awards` (empty), `acme-awards`, `demo-awards`, `dev-awards`,
  and `sandbox-awards`. David also confirmed that `demo` and `synthetics` TXT
  records are Award-related and must be excluded.
- Exclusion changes target configuration only; it does not delete source DNS.
- Zone-apex NS TTL is **172800 seconds (48 hours)**. This is the child zone's
  record TTL, not a measurement of the parent registry delegation TTL.

### Cloudflare export reviewed

The supplied `terianix.ai.txt` export was inspected locally. Its archival
header instructions are not migration actions: we are not importing it into
another DNS host or changing Cloudflare's SOA/NS.

| Website record | Exported current destination | Cutover destination (not applied) | TTL | Proxy |
| --- | --- | --- | --- | --- |
| Apex `terianix.ai` CNAME | `delightful-forest-0535e780f.7.azurestaticapps.net` | `zealous-rock-0c92ed20f.2.azurestaticapps.net` | 300 | DNS-only |
| `www.terianix.ai` CNAME | `delightful-forest-0535e780f.7.azurestaticapps.net` | `zealous-rock-0c92ed20f.2.azurestaticapps.net` | 300 | DNS-only |

No further TTL reduction or proxy change is needed for these two exported
records. Leave their destinations unchanged until TXT validation, HTTPS
readiness, and the data/write cutover gates pass. When approved, edit the two
existing records in place; do not replace or re-import the entire zone.

Keep all of the following unchanged:

- Cloudflare name servers `john.ns.cloudflare.com` and
  `rihana.ns.cloudflare.com`, and the domain registration.
- The four NS records delegating `is.terianix.ai` to the
  `ns1-09` / `ns2-09` / `ns3-09` / `ns4-09` Azure DNS servers.
- Ten non-website CNAME records, including Award frontends and `payroll-broker`.
- Zoho MX, SPF, DKIM, verification, and DMARC records. DMARC reporting uses an
  address at `terian-services.com`, so preserve that domain's mail routing too.
- Existing identity/domain verification TXT and the historical SWA validation
  TXT at the apex. Append new Azure-generated validation values; do not
  overwrite the root TXT values or remove source validation during rollback.

The export identifies record proxy flags, but does not establish current
zone-wide flattening settings, DNSSEC state, or redirect/Workers configuration.
Confirm those in Cloudflare without changing them.

The Cloudflare website records already match the desired 300-second,
DNS-only staging configuration.

### Protected new-platform Award hostnames

All four supplied hostnames are present in the Cloudflare export:

- `awards.demo-awardsrus.terianix.ai`
- `awards.acmerus.terianix.ai`
- `awards.syntheticsrus.terianix.ai`
- `awards.sandboxrus.terianix.ai`

Each exported CNAME points to
`black-forest-02e836b1e.4.azurestaticapps.net` with `cf-proxied:false`.
Keep these destinations, proxy settings, and TTL settings unchanged. This is
the Award frontend, not the Terianix marketing frontend
`zealous-rock-0c92ed20f.2.azurestaticapps.net`.

Only `terianix.ai` and `www.terianix.ai` website CNAMEs change at the approved
cutover. Do not change wildcard records, replace the whole Cloudflare zone,
or introduce redirect/Workers rules covering these Award hosts. Their existing
tenant-verification TXT records also stay unchanged in Cloudflare.

These records do not depend on the authoritative `terian-services.com` zone
being migrated. Excluding legacy Award records from that zone does not remove
these separate Cloudflare records. However, DNS preservation alone does not
prove that the destination SWA/bindings survive old-subscription deletion.
David reports they belong to the new subscription; the following operator-run
checks confirm that ownership and application readiness before retirement.

**David runs before and after the marketing-site cutover**; Codex does not run
these live checks:

```powershell
# Confirm the exported Award frontend belongs to the NEW subscription.
az staticwebapp list --subscription 2bb69129-5e74-44d9-af68-96d45633f667 --query "[?defaultHostname=='black-forest-02e836b1e.4.azurestaticapps.net'].{name:name,resourceGroup:resourceGroup,id:id}" -o table

# Once its name/resource group are confirmed, inspect its bindings:
# az staticwebapp hostname list --subscription 2bb69129-5e74-44d9-af68-96d45633f667 --name <confirmed-award-app> --resource-group <confirmed-award-rg> --query "[].{domainName:domainName,status:status}" -o table

$protectedAwardDomains = @(
  "awards.demo-awardsrus.terianix.ai",
  "awards.acmerus.terianix.ai",
  "awards.syntheticsrus.terianix.ai",
  "awards.sandboxrus.terianix.ai"
)
foreach ($protectedDomain in $protectedAwardDomains) {
  Resolve-DnsName -Name $protectedDomain -Type CNAME -Server john.ns.cloudflare.com
  Resolve-DnsName -Name $protectedDomain -Type CNAME -Server rihana.ns.cloudflare.com
  curl.exe --head "https://$protectedDomain/"
}
```

Expected CNAME: the exported `black-forest-02e836b1e.4.azurestaticapps.net`.
Expected Azure bindings: all four hostnames report `Ready` on that frontend
in the new subscription. HTTPS must pass certificate validation without `-k`;
check tenant-specific sign-in and application routing in a browser as well.
If existing CNAME flattening hides CNAME answers, inspect A/AAAA resolution
and HTTPS rather than changing working Cloudflare flattening settings.
If ownership/binding checks fail, stop subscription retirement and investigate;
do not repoint these hosts to a marketing frontend as a workaround.

### Target export reviewed

The target snapshot was inspected locally and confirms the intended target
subscription and tenant, both frontend hostnames, and slices **5** and **2**.
Neither target frontend has a custom-domain binding in that snapshot.

The target `terian-services.com` zone has only its automatic apex **NS and SOA**
record sets. The 16 other source record sets were not copied at export time. It is
therefore **not ready for authoritative delegation**, even though the zone
exists. Switching name servers now would omit the required website/mail records.

The assigned destination servers, for the eventual approved delegation only:

```text
ns1-08.azure-dns.com
ns2-08.azure-dns.net
ns3-08.azure-dns.org
ns4-08.azure-dns.info
```

The optional temporary regional-A fallback IP exported for the target Terian
Services SWA is `20.22.16.164`. It is evidence, not a change instruction; do
not use it before the alias-routing and traffic-cutover decision.

Source, target, and Cloudflare record exports are now reviewed. Still pending:
TXT validation/TLS readiness, full shadow-zone record preparation, the App
Service Domain delegation procedure, Cloudflare settings outside the export,
and the final data/write go/no-go.

## B. Prepare without switching traffic

1. Set existing **website** record TTLs to 300 seconds in their currently
   authoritative zones. Leave destinations unchanged.
2. Wait at least the **previous** TTL before changing destinations. Record
   the time; the legacy Terraform's 300-second setting does not prove the live
   TTL. In Cloudflare, use DNS-only/gray-cloud with manual TTL 300 for this
   direct-to-SWA path. If currently proxied, review the implications before
   disabling the proxy; do not silently change security or redirect behavior.
3. Copy only the approved non-Award terian-services.com records into the shadow
   zone. Compare contents and the explicit exclusion list, not just counts.
   Preserve MX, SPF/root TXT, DKIM, DMARC, Zoho, and retained verification
   records. Exclude Award names/endpoints and the confirmed demo/synthetics TXT.
4. Keep the target zone's own apex NS and SOA. Do not import the source apex
   NS/SOA or change registration yet. Preserve child NS records.
5. Review aliases separately: JSON preserves `targetResource` references;
   a zone-file import may not. Flag every reference to the old subscription.
   Some non-website records may intentionally remain there until their own
   migration; do not silently rewrite them.
6. Check CAA and DNSSEC before certificate issuance/delegation. Preserve mail
   and unrelated validation TXT when adding new SWA tokens.

Reducing A/CNAME TTLs does not reduce cached parent NS delegation. Keep both
Azure zones available and consistent throughout the observed transition and
agreed rollback window. If DNSSEC is enabled, agree the DS/key transition with
the registration operator before switching name servers.

Cloudflare proxied records use an automatic TTL, unlike a user-selected
DNS-only TTL. Reference: [Cloudflare TTL behavior](https://developers.cloudflare.com/dns/manage-dns-records/reference/ttl/).

## C. Bind all four hostnames to the target frontends

Determine old and new SWA slices from the exported default hostnames.
Current targets are slice **5** (Terian Services) and slice **2** (Terianix).
Both exports confirm source slice **7**, target Terian Services slice **5**,
and target Terianix slice **2**. The chosen path is therefore parallel TXT
validation without detaching source bindings. Keep all traffic records
unchanged during this preparation.

- **Different slices:** attempt target TXT ownership validation while leaving
  old bindings and traffic records in place.
- **Same slice:** Azure requires removing the old binding before adding the
  target binding. Schedule a maintenance window with an explicit rebind
  rollback procedure. Do not delete/redeploy the working target to chase a
  different slice without a separate decision.
- If parallel binding is rejected despite different slices, stop and
  investigate; do not remove the source binding during preparation.

Reference: [SWA domain migration and slice restriction](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain).

### C1. Target Terraform preparation

`domains.tf` is enabled in the local, ignored `terraform.tfvars`:

```hcl
custom_domains_enabled     = true
shadow_dns_records_enabled = true
source_dns_snapshot_path   = "../../domain-cutover-local/source-20261009T235904Z-3718a164/snapshot.json"
```

The production target root uses only the **target** Azure provider. It creates:

- Four `azurerm_static_web_app_custom_domain.migrated` bindings, now with
  CNAME validation for Terian Services www and TXT for the other three.
  The manually recreated www bindings keep the same Azure resource IDs;
  reconcile stale state metadata before applying, as described above.
- Target-zone apex A alias and www CNAME pointing to the target frontend.
- Two CNAME, five TXT, and one MX record set, preserving website/mail and
  retained verification values from the reviewed export.
- A local Terraform snapshot guard. Additional record types, child NS, or
  extra aliases fail closed rather than being silently omitted.

All seven Award-related record sets are explicitly excluded/reported. Filters
match Award record names, CNAME destinations, and alias IDs; CNAME overrides
cannot reintroduce them. NS/SOA remain the target zone's defaults.
Expect **14 additions** if the earlier plan was not applied:
4 bindings + 9 DNS record sets + 1 Terraform guard. If the earlier plan was
applied, do not bypass deletion protection; review the resulting state/removal
plan first. None of these preparation changes switches current public routing.

**David runs** while connected to the target tenant:

```powershell
terraform -chdir=terraform_terianix_platform/environments/prod init '-backend-config=backend.hcl'
terraform -chdir=terraform_terianix_platform/environments/prod validate
terraform -chdir=terraform_terianix_platform/environments/prod plan -out=domain-preparation-no-awards.tfplan
# Only after reviewing the saved plan:
terraform -chdir=terraform_terianix_platform/environments/prod apply domain-preparation-no-awards.tfplan
```

TXT validation is asynchronous: a successful apply does **not** establish
validation or TLS readiness. Do not change Cloudflare CNAMEs or delegation yet.

### C2. Save generated tokens before publishing validation DNS

Azure clears its computed validation token after a domain validates.
Persist it first so subsequent plans do not clear verification records:

```powershell
.\scripts\save-terianix-domain-validation.ps1
```

This operator-run script reads only the named target Terraform output and
writes two ignored `domain-validation.auto.tfvars.json` files. It saves all
four values in the target root and the two Terian Services values in the
temporary source-validation root. It refuses empty tokens, changed saved
tokens, and unrelated existing inputs. Back up these files privately.

Do not publish validation DNS before this step. Outputs are marked sensitive
by the provider; use explicitly named JSON outputs, not a dump of all outputs.

### C3. Publish Terian Services validation with isolated Terraform

The helper at `environments/source-domain-validation` initially owns a new
`_dnsauth.www` TXT record set in the existing `rg_platform` zone. It stores
both target Terian Services tokens in that set, following Microsoft's
pre-cutover validation instructions. The opt-in correction below also adopts
the existing apex TXT record set. It never owns the source zone, apex A alias,
www CNAME, applications, or registration.

The reviewed source export has no `_dnsauth.www` record. If a fresh plan
reports an existing record conflict, stop and review ownership before import;
do not overwrite it. The helper has its own **local** state in the ignored
cutover folder, so its state does not rely on the old Azure storage account.

**David runs** after connecting to the source tenant:

```powershell
az login --tenant 4d5f34d3-d97b-40c7-8704-edff856d3654
terraform -chdir=terraform_terianix_platform/environments/source-domain-validation init
terraform -chdir=terraform_terianix_platform/environments/source-domain-validation plan -out=source-validation.tfplan
# The only Azure addition should be one TXT record set:
terraform -chdir=terraform_terianix_platform/environments/source-domain-validation apply source-validation.tfplan
```

Then reconnect to the target tenant and plan/apply the target root again.
Persisted tokens add the target-zone validation TXT and append the apex token
to the existing copied root TXT without replacing mail/verification values.
The target zone then retains ownership proof during delegation. The source
apex proof also needs the correction below before calling preparation complete.

#### C3a. Correct the missing source apex proof

The operator's October 10 authoritative queries show both target proofs at
`_dnsauth.www.terian-services.com`, but only the four original TXT values at
`terian-services.com` itself. The target apex proof is missing from the
currently authoritative source apex. Microsoft's apex instructions publish it
at `@`; placing it only in the new, non-authoritative target zone is insufficient.
This is a concrete configuration gap and a likely reason the apex remains
Validating. It does not explain the two www bindings by itself.

The earlier source helper relied on the separate zero-downtime documentation's
shared `_dnsauth.www` location. Correct that omission without removing either
existing proof or recreating custom-domain bindings.

TXT/@ is a whole Azure record set, including mail SPF. Never replace it with a
single validation value. The opt-in helper reads its live values, TTL, and tags,
imports that same set, and appends only the saved Terian Services apex token.
The original Microsoft verification, SPF, and legacy SWA proof remain intact.
Repeated tokens are deduplicated.

The owner is not identified in the local Terian or Integrity Sentinel Terraform
definitions. David has approved temporary takeover rather than retaining the
old infrastructure/state. Local ignored `terraform.tfvars` therefore now sets:

```hcl
adopt_source_apex_txt = true
```

**Freeze all other Terraform applies that might own source TXT/@.** An old state
is not retired merely because it will be deleted later; reapplying it can remove
the new proof. Archive/retire or hand off that ownership deliberately. The
checked-in template remains disabled for other operators.

**David runs**, from any directory, after authenticating to the source tenant:

```powershell
Set-Location C:\Users\David\source\repos\Terian_Services\terraform_terianix_platform\environments\source-domain-validation
az login --tenant 4d5f34d3-d97b-40c7-8704-edff856d3654
terraform plan -out=source-apex-validation.tfplan
# Review first; apply only the approved saved plan:
terraform apply source-apex-validation.tfplan
```

With the existing www helper already applied, expect **1 import, 0 additions,
1 in-place change, 0 destroys**. The change must only append the target apex TXT
proof to `@`; all four original values, TTL 3600, tags, and `_dnsauth.www` stay
unchanged. Stop if the plan removes existing values or changes traffic records.
Old cached root TXT answers may persist for their prior 3600-second TTL.

After applying, repeat the authoritative root TXT query and check Azure's
hostname status. Do not change delegation, traffic CNAMEs, or old domain
bindings just because the validation update applied successfully.

Reference: [Microsoft apex ownership TXT at @](https://learn.microsoft.com/en-us/azure/static-web-apps/apex-domain-external#validate-ownership).

This helper is temporary and is archived/retired after cutover. Do not run
`terraform destroy`: once imported, it also owns the mail-bearing apex TXT set.
Both records have deletion protection. Do not disable adoption after importing
as a cleanup shortcut; that would propose deleting the record set. Retire its
state ownership explicitly when source DNS is no longer needed. The final
production root never authenticates to the source subscription.

### C4. Cloudflare validation stays manual

While connected to the target Terraform backend:

```powershell
terraform -chdir=terraform_terianix_platform/environments/prod output -json cloudflare_validation_records
```

The current output describes two TXT entries in Cloudflare: apex `@` proof
and www proof at `www`, matching David's successful manual validation.
These are already configured; review the current zone before changing it.
Do not replace SPF, legacy verification, CNAMEs, MX, or delegation records.
No Cloudflare API token, provider, import, or Terraform ownership is added.

The earlier `_dnsauth.www` method did not validate this Terianix www binding.
Do not restore it in place of the working TXT `www` proof. Azure DNS cannot
cohost TXT `www` with CNAME `www`; Terian Services www instead uses CNAME
validation and needs no TXT `www` proof.

References: [Terraform SWA token lifecycle](https://registry.terraform.io/providers/hashicorp/azurerm/3.98.0/docs/resources/static_web_app_custom_domain),
[Microsoft pre-cutover TXT method](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain#zero-downtime-migration),
[Apex ownership TXT](https://learn.microsoft.com/en-us/azure/static-web-apps/apex-domain-external#validate-ownership).

Confirm validation and TLS readiness for **each** hostname. Terraform's TXT
binding creation alone is not evidence of either. The HTTPS checks below
are operator-run diagnostics, not portal configuration.

The latest authoritative www answers match the saved target tokens in both
zones. Terianix apex was Ready in David's last Azure query; the other three
bindings were Validating. These answers prove publication, not certificate
readiness. The source apex correction is separate from any www delay. If www
remains pending after caching has elapsed, inspect Azure's status/error message
and recursive DNS answers before changing records or recreating bindings.

**David runs** these read-only status checks while authenticated to the target:

```powershell
az staticwebapp hostname list --subscription 2bb69129-5e74-44d9-af68-96d45633f667 --resource-group rg_terian_services_prod --name terian-services-frontend-platform --query "[].{Domain:domainName,Status:status,Error:errorMessage}" -o json
az staticwebapp hostname list --subscription 2bb69129-5e74-44d9-af68-96d45633f667 --resource-group rg_terian_services_prod --name terianix-frontend-platform --query "[].{Domain:domainName,Status:status,Error:errorMessage}" -o json
```

Optional pre-cutover HTTPS checks, **David runs after binding**:

```powershell
curl.exe --connect-to "terian-services.com:443:calm-plant-0158e0a0f.5.azurestaticapps.net:443" --head "https://terian-services.com/"
curl.exe --connect-to "www.terian-services.com:443:calm-plant-0158e0a0f.5.azurestaticapps.net:443" --head "https://www.terian-services.com/"
curl.exe --connect-to "terianix.ai:443:zealous-rock-0c92ed20f.2.azurestaticapps.net:443" --head "https://terianix.ai/"
curl.exe --connect-to "www.terianix.ai:443:zealous-rock-0c92ed20f.2.azurestaticapps.net:443" --head "https://www.terianix.ai/"
```

These retain the public hostname for HTTP and TLS while connecting to the
target. Do not use `-k` to bypass certificate validation. Both frontend configs
enable long-lived HSTS, so HTTP is not a certificate-gap fallback.

## D. Production go/no-go

Preparation does not authorize a write freeze or traffic cutover. Before switching:

- Complete final Cosmos/Blob synchronization and the queue drain/replay decision.
  The existing copier is create-only: it does not automatically overwrite
  changed records. Reconcile changes rather than blindly rerun it.
- Decide how clients with cached old DNS are handled. A mixed old/new backend
  period needs an explicit write/queue policy; one final copy cannot prevent
  later writes to the old backend.
- Confirm email, uploads, authentication/callbacks, CORS, AI, and monitoring.
  All four public origins are already configured in the target backend.
- Review historical signed-storage links and remaining legacy dependencies.
- Agree rollback triggers, observation window, and target-write recovery.
- Freeze legacy Terraform deployment/apply activity. Its Azure and Cloudflare
  records still point to old frontends and can undo manual edits.

Do not apply saved pre-cutover Terraform plans after manual changes.

## E. Earlier Azure-DNS hosting cutover (superseded)

This section records the previous Azure-authoritative-zone design. Do not
execute its target-Azure delegation steps for the Cloudflare design; use the
linked domain-transfer runbook instead. Retained DNS/app verification concepts
still apply.

Use two distinct checkpoints, not one unobservable batch.
Only Cloudflare changes below are manual. Azure traffic/delegation changes
are **design requirements for the next Terraform stage**, not instructions
to edit Azure in the portal. The current preparation configuration does not
modify the authoritative source website records or App Service Domain.
Do not proceed with Azure cutover until those ownership and supported
registration-migration questions have a reviewed Terraform implementation.

### E1. Website traffic

After go/no-go, switch apex/www for one brand, verify, then the other:

- **terianix.ai / Cloudflare:** edit existing apex and www CNAME values to
  `zealous-rock-0c92ed20f.2.azurestaticapps.net`. Keep DNS-only and TTL 300.
  Use apex flattening; do not enable flatten-all-CNAMEs or a proxy as part of
  the migration. Keep MX/TXT/other subdomain records unchanged.
- **terian-services.com / authoritative Azure zone:** the required future
  Terraform change is www to
  `calm-plant-0158e0a0f.5.azurestaticapps.net`. The final target-zone apex is
  an A alias to the target SWA resource ID. An alias in the **old tenant's zone**
  to the new tenant's SWA requires explicit support and permission checks.

If cross-tenant alias routing is unavailable, a reviewed temporary regular
A record using the target SWA's exported **stableInboundIP** is an option
in the old zone. Obtain it from Azure metadata, not an arbitrary resolved IP.
An A-record path provides regional, not global, routing. Do not create a
literal apex CNAME in Azure DNS. Without an approved apex path, hold that switch.

References: [Cloudflare apex flattening](https://developers.cloudflare.com/dns/cname-flattening/),
[SWA apex options](https://learn.microsoft.com/en-us/azure/static-web-apps/apex-domain-external),
[Azure cross-subscription alias prerequisites](https://learn.microsoft.com/en-us/azure/dns/dns-alias).
Cross-subscription support does not establish cross-tenant access.

### E2. Authoritative Azure zone

Only after the App Service Domain checkpoint is resolved:

1. Ensure the target zone has every required record, with apex/www pointing
   to the target Terian Services SWA: A alias for apex, CNAME for www.
2. Test the target zone directly against **each assigned name server**.
   Check the approved websites, mail/TXT records, and explicit Award exclusions.
3. Through the confirmed registration procedure, replace old delegation with
   the target zone's exact four servers from the target snapshot. Do not guess
   server numbers or mix old and new server sets.
4. Keep the old zone serving the same website destinations and unchanged
   non-website records while caches transition.
5. Confirm parent delegation, answers from multiple public resolvers, HTTPS
   for apex/www, email, and other application subdomains.

If delegation remains blocked, stop at E1 and retain old DNS hosting.
That can still allow expensive application resources to retire after other
gates pass; it does not authorize deleting old DNS/domain resources.

Reference: [Azure DNS delegation](https://learn.microsoft.com/en-us/azure/dns/dns-delegate-domain-azure-dns).

## F. Verify, rollback, and record ownership

Check all four public HTTPS URLs, certificates, deep links, browser API calls
to the new backend, login/callbacks, forms/email, uploads, analytics, and CORS.
Check inbound/outbound mail and non-website subdomains. Record times and results.

Rollback is not simply restoring name servers:

- Restore saved website destinations in both Azure zones and Cloudflare as
  applicable. Re-establish detached source bindings and valid TLS before
  sending clients back.
- Reverse delegation only through the confirmed registration procedure.
  Cached NS answers can still send clients to either zone.
- Reconcile target writes/queue messages before the old backend resumes
  authoritative writes. Preserve target data.

Keep source resources, validation records, old DNS zone, and registration
through the agreed rollback/propagation window. Restore normal website TTLs
afterward, typically their original values. Do not delete resource groups here.

### Permanent subscription-retirement gate

The target Terraform owns new Azure records/bindings; source record copies are
offline configuration inputs, not live provider dependencies. Keep the source
snapshot available until its record inventory has been promoted to a reviewed
long-term configuration. Moving/deleting the snapshot can break future plans.

`dns_retirement_review` reports retained non-Award CNAMEs and all deliberate
Award exclusions. Award endpoints must not be copied or restored through
`dns_cname_overrides`. Retain the protected new-platform Cloudflare Award
hostnames above; confirm their SWA ownership and bindings before deleting the
old subscription. Other Cloudflare endpoints such as `payroll-broker` remain
outside this Terraform scope and require their own retirement review.

Before deleting the old subscription, additionally resolve:

- App Service Domain registration, renewal ownership, and authoritative DNS.
  Old registration cannot remain as a permanent fallback.
- Old state storage: retain/export an encrypted archive outside that subscription.
- Historical blob links, final data synchronization, queues, identities, and
  telemetry retention. Inventory the **whole subscription**, not just these
  two resource groups, before approval.
- Production GitHub workflows/environment variables and OIDC. The migration
  branch currently selects the target environment; the main branch must not
  continue deploying to the old subscription after retirement.
- The temporary source validation root and its local state.
- Legacy Cloudflare Terraform ownership. Freeze/archive the old root and
  explicitly retire its Cloudflare state ownership without deleting records.
  **Do not run `terraform destroy` on the old root:** it can destroy live
  Cloudflare records even after Azure has migrated.

Registration/delegation Terraform has not been enabled because the supported
cross-tenant route is unresolved. This is an explicit remaining blocker, not
a manual Azure portal cutover instruction. Cloudflare remains the only planned
manual DNS configuration path.

No init, live plan, apply, state edits, subscription deletion, or Azure/Cloudflare
writes have been run by Codex.

### Local verification

Both Terraform roots passed schema validation using already installed providers.
Ten fully mocked target tests (including the actual local source export
and protection of the four new-platform Award hosts)
and three mocked helper tests passed. Offline token-saving tests passed for
correct root scoping, repeatability, and rejection of empty/changed tokens.
No live plan was run; David must still inspect the Azure plan and confirm
validation/TLS status after applying.
