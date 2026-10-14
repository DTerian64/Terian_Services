# Moving terian-services.com domain registration from Azure to Cloudflare

Updated: October 12, 2026 (America/Los_Angeles).

Status: unselected historical alternative. On October 12 David chose
Azure-retained relocation and approved source subscription directory reassociation.
No transfer, delegation change, subscription directory change, or deletion
has been performed by Codex. The Azure-retained alternative is documented in
[Moving the App Service Domain to the new subscription](moving_terian_services_com_app_service_domain_to_new_subscription.md).

## 1. Decision and final design

If this alternative is selected, transfer the existing `terian-services.com` registration to Cloudflare Registrar
and make Cloudflare its authoritative DNS provider. Keep ownership continuously;
do not cancel the registration and attempt to buy the domain again.

This was considered on October 10. David selected the Azure subscription-move
route on October 12. The design below is retained for reference only; do not
create or transfer terian-services.com registration to Cloudflare under this plan.

| Responsibility | Permanent owner |
| --- | --- |
| terian-services.com registration and renewal | Cloudflare Registrar |
| terian-services.com DNS records and delegation | Cloudflare; manually managed |
| terianix.ai registration/DNS | Existing Cloudflare setup; no registrar transfer |
| Websites, backend, storage, Cosmos DB, and Azure SWA domain bindings | New Azure subscription; Terraform-managed |
| Old Azure registration and DNS | Temporary only, until their retirement gates pass |

No Cloudflare Terraform provider is wanted. Under this proposal, the target Azure DNS zone becomes
an unused preparation artifact, not a second permanent DNS authority.

David performs all live operations and payments. Codex prepares/reviews local
files only. Azure infrastructure changes remain Terraform-managed. Any
one-time registrar action through Azure's API/portal needs an explicitly
reviewed operator procedure or Terraform implementation; this document does
not silently waive that constraint.

One application cutover window is desired, with outage accepted. Registrar
processing is a separate clock: it need not be the duration of a website outage.
Retaining the registration briefly while transfer processes is not the
rejected permanent multi-tenant design.

## 2. Where we stand

These are last-confirmed facts from David's outputs/screenshots and local
exports, not fresh live checks by Codex.

| Item | Evidence / current status |
| --- | --- |
| Source subscription | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` |
| Source tenant | `4d5f34d3-d97b-40c7-8704-edff856d3654` |
| Target subscription | `2bb69129-5e74-44d9-af68-96d45633f667` |
| Target tenant | `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` |
| Existing registration | Azure App Service Domain `rg_platform/terian-services.com` |
| Supplied registration metadata | Active; auto-renew enabled; privacy enabled; expires January 26, 2027 |
| Existing DNS zone | Source `rg_platform/terian-services.com`; original export had 18 record sets |
| Source authoritative server set | `ns1-04.azure-dns.com`, `ns2-04.azure-dns.net`, `ns3-04.azure-dns.org`, `ns4-04.azure-dns.info` |
| Registration's DNS link | References missing/historical `rg_award_nomination` zone, not the observed `rg_platform` zone; unresolved stale-link issue |
| Target Azure shadow zone | Already created in `rg_terianix_platform`, with ns*-08 servers; do not delegate to these under the new design |
| Target application infrastructure | Provisioned in `rg_terian_services_prod`; deployments and initial data copy completed |
| Public Terian Services www routing | David confirmed target `calm-plant-0158e0a0f.5.azurestaticapps.net`; authoritative DNS still source Azure |
| Public Terianix www routing | David changed Cloudflare CNAME to target `zealous-rock-0c92ed20f.2.azurestaticapps.net` and confirmed the site worked |
| Target domain readiness | Terian Services www Ready using CNAME; Terianix apex Ready and www validated; Terian Services apex needs a fresh check |
| Target validation proofs | Persisted locally; source apex proof added while preserving all four original root TXT values |
| Public TXT visibility | Correct proofs returned by authoritative servers, 1.1.1.1, and 8.8.8.8 |
| Cloudflare terian-services.com zone | Creation, assigned servers, and activation not yet confirmed |
| Registrar access / unlock / EPP code | Not yet confirmed; transfer has not been initiated |
| DNSSEC and transfer eligibility | Must be checked |

The working public URLs do not establish target ownership. Both www answers
above still point to source. The root's last exported A alias also references
the source SWA; obtain current routing evidence before cutover.

Two target apps:

- Terian Services: `terian-services-frontend-platform`,
  `calm-plant-0158e0a0f.5.azurestaticapps.net`.
- Terianix: `terianix-frontend-platform`,
  `zealous-rock-0c92ed20f.2.azurestaticapps.net`.

Target backend:
`terian-services-backend-prod.wittystone-9c30e054.eastus2.azurecontainerapps.io`.

Private evidence is under `terraform_terianix_platform/domain-cutover-local/`.
The original source snapshot predates the additional validation TXT; obtain a
fresh inventory, but do not replace the original snapshot input used by the
existing target Terraform guard without reviewing that configuration.

## 3. First checkpoint: can Azure registration be delegated to Cloudflare?

Cloudflare requires its DNS zone to be Active before accepting a registration
transfer. Merely obtaining an EPP code is not enough. Its registrar also requires
Cloudflare DNS permanently.
[Cloudflare prerequisites](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/).

For this Azure App Service Domain, the unresolved prerequisite is a supported
way to change registrar-level nameservers while Azure still manages registration.
Do not assume the Azure DNS zone's NS record or `dnsZoneId` is that control.

David should inspect the domain's available management controls without editing:

- Can the actual registration's nameservers be changed?
- Is registrar-level access available, and can transfer lock be removed?
- Is the current registrant email accessible for approval messages?
- If a GoDaddy-backed management page is offered, does it provide usable access
  to this exact domain? Do not assume Azure login credentials work there.

If the controls are absent or inaccessible, request Azure App Service Domain
support to confirm the supported delegation/unlock procedure. A May 2026
Microsoft Q&A case reports the same Azure-to-Cloudflare obstacle despite a
working transfer-out API. That is evidence of a possible limitation, not proof
that this account has the same restriction.
[Reported Azure registrar-access issue](https://learn.microsoft.com/en-us/answers/questions/5890598/i-am-unable-to-transfer-an-app-service-domain-out).

Suggested support request:

> We own terian-services.com, registered through Azure App Service Domain in
> subscription 4ddf12bb-5397-445f-bcaa-df4c7d3dfdca, resource group rg_platform.
> We need to transfer registration to Cloudflare. Cloudflare requires its
> nameservers to be active before transfer. Please confirm how to update the
> registrar delegation and remove transfer lock without cancelling the domain.
> The registration's dnsZoneId also references a historical rg_award_nomination
> zone, whereas the working DNS zone is in rg_platform.

Do not delete the domain, recreate the historical zone, change a subscription's
tenant, or guess an Azure API update to bypass this checkpoint.

If direct delegation cannot be enabled, an intermediate registrar may be
necessary. This would require a new decision: it adds a transfer and can impose
a 60-day wait before the final Cloudflare transfer. It is not authorized or
assumed here. DNS/application cutover can be separate from that waiting period.
The final design remains Cloudflare, but direct completion is not guaranteed.

## 4. What still needs completion

- [ ] Confirm the direct delegation and registrar-unlock route above.
- [ ] Verify Cloudflare account administrator access, email, and payment method.
- [ ] Verify registrant contact access and actual registry transfer restrictions.
- [ ] Check recent transfers/contact changes; January registration age alone
      does not establish current eligibility.
- [ ] Establish DNSSEC/DS status and the supported transition procedure.
- [ ] Obtain fresh private source DNS and registration exports; archive state
      outside the old subscription.
- [ ] Create and review the Cloudflare zone and its complete approved inventory.
- [ ] Recheck target bindings/TLS; unresolved validation is a separate issue.
- [ ] Review the one-window traffic/data cutover and exact source-removal scope.
- [ ] Activate Cloudflare DNS through the confirmed registrar procedure.
- [ ] Obtain EPP/auth code securely, unlock, initiate transfer, and approve it.
- [ ] Confirm completed registrar transfer, renewal, mail, and target routing.
- [ ] Retire Azure DNS/registration remnants and reconcile Terraform ownership.

Transfer restrictions include recent registration, registrar changes, and
certain contact changes. Do not edit contacts simply to prepare transfer:
that can introduce another lock.
[Cloudflare transfer eligibility FAQ](https://developers.cloudflare.com/registrar/faq/).

Keep Azure's renewal enabled until handoff is confirmed. Do not disable privacy
reflexively: Azure documents that it cannot be re-enabled there once disabled.
Review whether it is required for this transfer before agreeing to that change.
[Azure domain management](https://learn.microsoft.com/en-us/azure/app-service/manage-custom-dns-buy-domain).

Registry transfer lock and an Azure resource deletion lock are different.
Removing a deletion lock does not establish that a registrar transfer is unlocked.

## 5. Build the Cloudflare DNS inventory

Use the approved retained record set, not an indiscriminate whole-zone import.
Cloudflare's discovery scan is not a completeness check; compare against our
reviewed export.
[Cloudflare full-setup guidance](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/).

| Type / name | Planned content or handling |
| --- | --- |
| CNAME `@` | `calm-plant-0158e0a0f.5.azurestaticapps.net`; DNS-only, TTL 300, apex flattening |
| CNAME `www` | Same target hostname; DNS-only, TTL 300 |
| MX `@` | Keep all three: 10 `mx.zoho.com`, 20 `mx2.zoho.com`, 50 `mx3.zoho.com` |
| TXT `@` | Keep original Microsoft verification values, existing SPF, and legacy SWA proof; include saved target apex token |
| TXT `_dnsauth.www` | Two separate values: saved target Terian Services apex and www tokens; TTL 300 |
| TXT `_dmarc` | Preserve exact current policy |
| TXT `zmail._domainkey` | Preserve exact DKIM key |
| TXT `asuid` and `zoho` | Preserve retained verification values |
| CNAME `zb14665664` | Preserve `zmverify.zoho.com`; DNS-only |
| Other newly discovered non-Award records | Review ownership and destination before inclusion |

Convert the Azure apex A alias to a flattened Cloudflare CNAME; do not copy an
Azure resource ID or an arbitrary resolved shared IP into Cloudflare.
Cloudflare flattening applies to the root; do not enable flatten-all-CNAMEs or
proxying as part of this migration.
[CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/).

Do not import source SOA or apex NS. Cloudflare supplies its own. Use the exact
nameservers assigned to the new terian-services.com zone; do not reuse
terianix.ai's john/rihana pair unless Cloudflare actually assigns them.

Exclude these legacy terian-services.com entries, as previously agreed:

- CNAME: `acme-awards`, `awards`, `demo-awards`, `dev-awards`, `sandbox-awards`.
- TXT: `demo`, `synthetics`.

Keep exact validation values in the ignored
`terraform_terianix_platform/environments/prod/domain-validation.auto.tfvars.json`,
not in this document. The original source snapshot alone lacks the newly
published proof records. Multiple TXT proofs are not justification for removing
SPF, DKIM, mail verification, or the saved target tokens.

Do not change the existing terianix.ai zone's Award records:

- `awards.demo-awardsrus.terianix.ai`
- `awards.acmerus.terianix.ai`
- `awards.sandboxrus.terianix.ai`
- `awards.syntheticsrus.terianix.ai`

Their exported CNAME target is `black-forest-02e836b1e.4.azurestaticapps.net`.
Preserve the `is.terianix.ai` delegation and `sandbox.is.terianix.ai` routing.
Working URLs alone do not verify their subscription/backend ownership.

## 6. Execute the mandatory transfer

### A. Prepare before the outage

Finish checkpoints 3–5. In Cloudflare, add terian-services.com to the intended
account, select the appropriate plan, review every retained DNS value, and
record its assigned nameservers privately. Do not submit payment/transfer yet.

If DNSSEC is enabled, remove the old registrar DS through the confirmed
procedure before switching nameservers. Cloudflare recommends allowing at least
24 hours for that change. Do not carry old signing data into the new authority.
[DNSSEC transition](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/#disable-dnssec).

Prepare backups and final source write freeze, data reconciliation, queue
handling, and historical blob-link disposition. The existing data copier is
create-only; rerunning it does not overwrite changed existing Cosmos documents.

Freeze legacy deployment/apply activity. Its Cloudflare resources can restore
source routing or delete live records. Archive its state rather than running
an unrestricted old-root destroy.

### B. Application and DNS cutover window

David accepts outage, but an exact duration is not guaranteed. It is permissible
to complete target validation during the window rather than require a
zero-downtime prebind; visitors may see errors until valid bindings/TLS exist.
Do not disable HSTS or use certificate bypasses as a production workaround.

Perform the reviewed final delta and source-write freeze. If retiring source
bindings/apps in this window, limit deletion to the reviewed resources; retain
registration, authoritative DNS, and required data until their own gates pass.
Detaching old bindings is not a proven fix for target validation.

Through the supported registrar operation, change terian-services.com delegation
to its assigned Cloudflare nameservers. Its prepared root/www records route to
the target SWA. In the existing terianix.ai zone, manually change only marketing
root/www CNAME destinations to `zealous-rock-0c92ed20f.2.azurestaticapps.net`.
Preserve mail, Award, and Integrity Sentinel records.

Verify both brands and backend calls. Keep source DNS available for stale
delegation caches. Cloudflare DNS activation and target certificate readiness
are separate checks, not equivalent success signals.

### C. Registrar transfer

Once the Cloudflare zone is Active, use its Transfer Domains flow. Unlock the
registration through the supported current-registrar procedure, obtain the
authorization code, enter it privately in Cloudflare, review the price/contact
details, confirm payment, and approve any legitimate transfer emails.
[Cloudflare transfer process](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/).

Azure's App Service team documents a transfer-out action that returns an
`authCode`:

```text
PUT /subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.DomainRegistration/domains/terian-services.com/transferout?api-version=2021-02-01
```

This is a documented mutation, not a read-only check or an instruction to run
now. Verify the supported API version and approve its execution mechanism
beforehand. The AzureRM registration transfer is not implemented in the current
Terraform root.
[Azure transfer-out instructions](https://azure.github.io/AppService/2021/09/22/2021-Managing-ASD.html).

Treat the EPP code as a secret: no Git, chat, screenshots, ordinary logs, or
unprotected Terraform output/state. An EPP code is not a SWA deployment token or
a public DNS validation token. Do not request it prematurely and let it expire.

Cloudflare says transfers can take up to 10 days. DNS already serving the new
apps can continue while the registrar processes the transfer. Do not delete
Azure registration or cancel the old subscription during that pending period.

### D. Verify the completed handoff

Confirm Cloudflare reports transfer completed, actual registrar ownership has
changed, registrant email is verified, and renewal/payment settings are valid.
Expected expiry is normally January 26, 2028, based on the supplied January 26,
2027 expiry and a one-year transfer extension; verify the actual result.
[Registration term and renewal FAQ](https://developers.cloudflare.com/registrar/faq/).

After delegation and transfer settle, enable Cloudflare DNSSEC through its
supported registrar-integrated flow if desired, and verify resolution again.

## 7. Verification and retirement

David runs read-only checks; Codex does not execute them:

```powershell
Resolve-DnsName terian-services.com -Type NS -Server 1.1.1.1
Resolve-DnsName terian-services.com -Type NS -Server 8.8.8.8
Resolve-DnsName www.terian-services.com -Type CNAME -Server 1.1.1.1
Resolve-DnsName www.terianix.ai -Type CNAME -Server 1.1.1.1
```

Also compare the new zone directly at every assigned Cloudflare nameserver.
Flattened apex answers do not identify a subscription on their own. Verify
target-origin content/headers or target logs in addition to DNS.

- [ ] All four marketing custom domains are Ready and serve valid HTTPS.
- [ ] Root/www, deep links, forms, email, uploads, and authentication work.
- [ ] Browser API calls reach the target backend, not a legacy API URL.
- [ ] Inbound/outbound Zoho mail and SPF/DKIM/DMARC remain correct.
- [ ] Protected Award and Integrity Sentinel sites/delegation remain correct.
- [ ] Registrar transfer is completed, not merely submitted or DNS Active.
- [ ] No current or cached delegation depends on the old Azure DNS zone.
- [ ] State/evidence backups and all source data dependencies are resolved.

Only then review retirement of:

1. Old DNS zone and temporary source-validation root ownership.
2. Azure App Service Domain remnants, if any remain after transfer. Confirm the
   transfer/status with Azure before deleting a leftover resource.
3. Target Azure shadow zone/records, now unnecessary.
4. Remaining reviewed source workloads and, ultimately, the old subscription.

Do not destroy the whole source-validation helper: it imported the mail-bearing
TXT/@ set. Do not simply disable `shadow_dns_records_enabled` or remove its
snapshot to clean up target DNS: deletion protections and existing state require
a deliberate Terraform change. Keep target SWAs and their custom-domain
bindings; Cloudflare hosting DNS does not replace those Azure resources.

The already-provisioned target root has not been changed by writing this
document. A later reviewed change must remove obsolete Azure DNS ownership,
adjust DNS-related outputs/docs/tests, and retain all application/domain-binding
resources. No Cloudflare provider is to be introduced.

## 8. Cost and immediate next action

As checked October 10, .com registration/renewal/transfer is US$10.46.
Cloudflare lists US$11.17 from November 1, 2026. Confirm the checkout total and
any tax; rates can change.
[Current rates](https://pricing.registrar.cloudflare.com/),
[Announced change](https://pricing.registrar.cloudflare.com/price-changes).

**Next action:** David checks the current App Service Domain's registrar-level
nameserver/unlock controls and contact access, without deleting or changing
anything. If unavailable, obtain Azure Support's supported route. That result
determines whether a direct Azure-to-Cloudflare transfer is executable.

No need to stop a working SWA or erase DNS merely to investigate this gate.
Cancellation/re-purchase is not a fallback: registry release is not immediate
and continuous ownership would be lost.
[ICANN cancellation guidance](https://www.icann.org/resources/pages/domain-name-renewal-expiration-faqs-2018-12-07-en/).
