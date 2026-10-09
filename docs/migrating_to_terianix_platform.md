# Migrating to the Terianix Platform

## Purpose

Migrate the Terian Services Award Nomination monitoring integration from the
legacy Award resources in subscription
`4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` to the consolidated Terianix platform
in subscription `2bb69129-5e74-44d9-af68-96d45633f667`.

The final infrastructure objective is to delete the legacy
`rg_award_nomination_sandbox` resource group. The legacy subscription itself
will remain active.

This migration must preserve:

- The Terian Services `GET /api/metrics/awards` endpoint.
- Backend request, failure, latency, nomination, and session metrics.
- Frontend page-view and unique-user metrics.
- Azure Container Apps replica metrics.
- Award SQL database storage metrics.
- Existing Award Nomination application functionality required before the old
  resource group can be removed.

## Current Terian Services Integration

The Terian Services backend reads Award telemetry and resource metrics through
`backend/routers/metrics_router.py`.

It currently consumes:

| Setting | Legacy resource |
| --- | --- |
| `APPINSIGHTS_RESOURCE_ID` | Backend Application Insights component |
| `AWARD_APPI_FRONTEND_RESOURCE_ID` | Frontend Application Insights component |
| `AWARD_ACA_PRIMARY_RESOURCE_ID` | Primary Award API Container App |
| `AWARD_ACA_SECONDARY_RESOURCE_ID` | Secondary Award API Container App |
| `AWARD_SQL_DB_RESOURCE_ID` | Award SQL database |
| Backend Log Analytics resource ID | Workspace RBAC scope |
| Frontend Log Analytics resource ID | Workspace RBAC scope |

The endpoint runs three Application Insights KQL queries and three Azure
Monitor metric queries concurrently. Results are cached in-process for five
minutes.

The current response contract includes two Container Apps:

```json
{
  "compute": {
    "aca_primary": 1,
    "aca_secondary": 0,
    "sql_mb": 1650.56
  }
}
```

Both Terian frontends render separate **ACA primary** and **ACA secondary**
cards.

## Target Terianix Resources

The target infrastructure is defined in:

```text
C:\Users\David\source\repos\Integrity_Sentinel
```

The Award application source is under:

```text
src/apps/award_nomination
```

The Award Terraform module is under:

```text
infra/terraform/apps/award
```

The following resources were verified as deployed in the target subscription:

| Dependency | Target resource |
| --- | --- |
| Backend Application Insights | `rg_award_nomination_sandbox/appi-award-api-sandbox` |
| Frontend Application Insights | `rg_award_nomination_sandbox/appi-award-frontend-sandbox` |
| Award API Container App | `rg_award_nomination_sandbox/award-api-sandbox` |
| Award SQL database | `rg_integrity_sentinel_sandbox/sql-integritysentinel-sandbox/AwardNominationsSandbox` |
| Shared Log Analytics workspace | `rg_integrity_sentinel_sandbox/law-integritysentinel-sandbox` |
| Log Analytics workspace ID | `2c61a2f7-306e-40db-82eb-4bee5a66aa1b` |

The target Award API health endpoint was verified to return:

```json
{"status":"ok"}
```

### Target ARM Resource IDs

```text
/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.Insights/components/appi-award-api-sandbox

/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.Insights/components/appi-award-frontend-sandbox

/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.App/containerApps/award-api-sandbox

/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_integrity_sentinel_sandbox/providers/Microsoft.Sql/servers/sql-integritysentinel-sandbox/databases/AwardNominationsSandbox

/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_integrity_sentinel_sandbox/providers/Microsoft.OperationalInsights/workspaces/law-integritysentinel-sandbox
```

## Architectural Differences

### One Award API Container App

The legacy deployment has two regional Award API Container Apps. The target
sandbox has one API Container App named `award-api-sandbox` with one fixed
replica.

Terian must stop modeling the target as primary and secondary. The preferred
response contract is:

```json
{
  "compute": {
    "aca_replicas": 1,
    "sql_mb": 1650.56
  }
}
```

The two frontend implementations must replace the primary and secondary cards
with one **API replicas** card.

### Shared Log Analytics Workspace

The target backend and frontend Application Insights components use the same
shared Log Analytics workspace.

The target workspace has resource-context access enabled. Terian queries the
Application Insights components through `LogsQueryClient.query_resource()`, so
the monitoring identity can be scoped to the two Application Insights
resources without receiving broad read access to all data in the shared
workspace.

The existing Terian Terraform creates separate backend and frontend workspace
role assignments. Pointing both variables at the same target workspace risks a
duplicate role assignment. These role assignments should be removed for the
target design.

The `app_insights_workspace_id` Terraform value is not currently used by the
metrics router and should be removed unless a new explicit workspace query is
introduced.

## Cross-Tenant Authentication Blocker

The subscriptions belong to different Microsoft Entra tenants:

| Environment | Tenant ID |
| --- | --- |
| Terian Services and legacy Award resources | `4d5f34d3-d97b-40c7-8704-edff856d3654` |
| Terianix platform | `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` |

Terian currently authenticates with this user-assigned managed identity:

| Property | Value |
| --- | --- |
| Name | `uami-terian-services-backend` |
| Client ID | `f4b8fdb6-f64f-4df2-a9e3-637559312b82` |
| Principal ID | `36013e38-bb4f-4cd7-a403-5e05358c44ab` |

An ordinary Azure role assignment cannot grant this managed identity access to
resources in the target tenant. Updating only the resource IDs in
`terraform.tfvars` will therefore break the metrics endpoint.

### Recommended Authentication Design

Use Microsoft Entra workload identity federation:

1. Create a multitenant Entra application in the Terian Services tenant.
2. Add a federated identity credential that trusts
   `uami-terian-services-backend`.
3. Provision the application's service principal in the Terianix tenant.
4. Grant the target service principal `Monitoring Reader` on:
   - `appi-award-api-sandbox`
   - `appi-award-frontend-sandbox`
   - `award-api-sandbox`
   - `AwardNominationsSandbox`
5. Add the target tenant ID and federated application client ID to the Terian
   backend configuration.
6. In the metrics router, obtain a managed-identity token for
   `api://AzureADTokenExchange/.default` and exchange it through
   `ClientAssertionCredential` for a target-tenant token.
7. Use that credential only for Award metrics. Keep the existing managed
   identity credential for Terian-owned resources.

This design is secretless and supports resource-level RBAC in the target
tenant. It avoids storing and rotating a cross-tenant client secret.

Azure Lighthouse was considered but is not preferred. The Award database is a
child of a SQL server in the shared Integrity Sentinel resource group, so a
resource-group-level Lighthouse delegation would expose more of the shared
platform than the metrics integration needs.

## Required Terian Services Changes

### Backend

- Add a cross-tenant credential factory for Award monitoring.
- Preserve `DefaultAzureCredential` for local development when federated
  settings are absent.
- Replace `AWARD_ACA_PRIMARY_RESOURCE_ID` and
  `AWARD_ACA_SECONDARY_RESOURCE_ID` with one `AWARD_ACA_RESOURCE_ID`.
- Replace `aca_primary` and `aca_secondary` with `aca_replicas` in the response.
- Retain independent failure handling so one unavailable metric does not fail
  the entire endpoint.
- Add tests for:
  - Federated credential selection.
  - Local credential fallback.
  - One-container response shape.
  - Partial KQL or metric failures.
  - Cache behavior.

### Terraform

- Add variables for the target tenant ID and federated application client ID.
- Inject those values into the Terian backend Container App.
- Replace the two Award Container App inputs with one input.
- Remove the unused workspace GUID input.
- Remove the two target Log Analytics workspace role assignments.
- Do not attempt to assign target-tenant roles to the source managed-identity
  principal.
- Manage the target enterprise application and its four scoped role assignments
  from Terraform authenticated to the Terianix tenant.
- Update both the ignored production `terraform.tfvars` and the committed
  `terraform.tfvars.template`.

### Frontends

Update both components:

```text
frontend/src/components/AwardMetrics.tsx
terianix_frontend/src/components/AwardMetrics.tsx
```

Required changes:

- Replace `aca_primary` and `aca_secondary` with `aca_replicas`.
- Render one **API replicas** card.
- Adjust the compute-card layout from four cards to three, or add another
  meaningful metric instead of leaving a secondary placeholder.
- Update the live-metrics workflow diagrams so they no longer describe two
  Award API Container Apps or separate backend/frontend workspaces.

## Broader Resource-Group Deletion Readiness

Migrating the Terian metrics endpoint is necessary but is not sufficient to
delete the old Award resource group.

The old resource group still contains active resources including:

- Two Award API Container Apps and two Container Apps environments.
- The old Award Static Web App.
- The old Front Door profile, endpoint, and WAF policy.
- Four existing tenant-facing frontend domains.
- SQL Server and the legacy Award database.
- Service Bus namespace, topic traffic, and consumers.
- Application Insights and Log Analytics workspaces.
- Storage, Key Vault, ACR, and Azure OpenAI resources.
- Auxiliary, payroll, inference, and inference-extension services.
- Analytics and schema-migration jobs.
- Logic App, workbooks, dashboard, and monitoring resources.
- The legacy External ID/CIAM directory resource.

### Domain and Routing Gap

The old Static Web App currently owns:

```text
sandbox-awards.terianix.ai
acme-awards.terianix.ai
demo-awards.terianix.ai
synthetic-awards.terianix.ai
```

The new Static Web App has a different set of registered domain names. The
shared target Front Door currently exposes the Integrity Sentinel endpoint,
but no Award-specific endpoint was visible during the initial inventory.

Before deleting the old resource group, decide whether the four legacy domains
must be preserved, redirected, or formally retired. Deleting the resource group
while those domains are still bound to the old Static Web App will break them.

### Required Application Validation

Validate all of the following against the target deployment:

- Public frontend loading and tenant selection.
- Authenticated sign-in for every customer directory.
- User lookup and tenant isolation.
- Nomination submission and approval.
- HRBP review and fraud workflows.
- Notification and email processing.
- Service Bus publishing, filters, consumers, and scale rules.
- Payroll broker callback routing.
- Certificate generation using the target template and storage account.
- Model loading, fraud scoring, inference, and explanation generation.
- Analytics and scheduled job execution.
- Schema migration job behavior and current Alembic revision.
- SQL managed-identity access.
- Key Vault and blob access from each workload identity.
- Front Door routing, WAF behavior, health probes, CORS, and redirects.

Drain or explicitly discard all pending messages from the legacy Service Bus
before deleting it.

## Migration Sequence

### Phase 1: Establish Cross-Tenant Monitoring Identity

1. Create the multitenant monitoring application.
2. Add the managed-identity federated credential.
3. Provision the enterprise application in the target tenant.
4. Apply the four scoped target role assignments.
5. Verify token exchange from the Terian Container App.

### Phase 2: Update Terian Metrics

1. Implement the federated credential factory.
2. Change the Container App metric model from two resources to one.
3. Update Terraform variables and Container App environment settings.
4. Update both Award metrics UI components and diagrams.
5. Add automated backend tests.
6. Deploy without removing the old configuration until validation passes.

### Phase 3: Validate the Metrics Cutover

1. Record the legacy endpoint response as a baseline.
2. Query the target backend and frontend Application Insights components.
3. Verify request, failure, latency, nomination, session, page-view, and
   unique-user values.
4. Verify the target Container App replica and SQL storage metrics.
5. Confirm partial failures still return the remaining metrics.
6. Observe the endpoint for at least 24 hours so its complete lookback window
   comes from the target resources.

Historical Application Insights data does not automatically migrate. Export
legacy telemetry before deletion if history beyond the cutover is required.

### Phase 4: Complete the Award Platform Cutover

1. Complete target Front Door origins, routes, domains, certificates, WAF, and
   payroll callback routing.
2. Complete tenant-domain and External ID cutover.
3. Validate database-backed, certificate, model, analytics, and messaging
   workflows.
4. Move or retire the four legacy frontend domains deliberately.
5. Stop legacy publishers and consumers and drain Service Bus.
6. Confirm no DNS, CI/CD, application setting, managed identity, or monitoring
   reference points to the old resource group.

### Phase 5: Decommission the Legacy Resource Group

1. Take a final resource inventory and dependency export.
2. Preserve any required telemetry, database backup, model artifact, or audit
   history.
3. Disable old workload ingress or scale workloads down for a rollback window.
4. Monitor the target deployment during the rollback window.
5. Remove the old resource group only after all deletion gates pass.

## Deletion Gates

Do not delete the legacy `rg_award_nomination_sandbox` until every item below is
true:

- [ ] Terian metrics use the target subscription exclusively.
- [ ] Cross-tenant token exchange works without stored secrets.
- [ ] Target backend and frontend KQL queries return expected data.
- [ ] The one-container replica metric and SQL storage metric work.
- [ ] Both Terian frontends display the new response correctly.
- [ ] Target Award API health and database-backed endpoints pass.
- [ ] All required customer sign-in flows pass.
- [ ] Tenant isolation is verified.
- [ ] Nomination, approval, HRBP, notification, payroll, and certificate flows
      pass.
- [ ] Fraud models and inference services pass target-storage validation.
- [ ] Shared Service Bus consumers work and the legacy namespace is drained.
- [ ] Front Door, WAF, CORS, redirects, and health probes pass.
- [ ] Legacy domains are moved, redirected, or retired intentionally.
- [ ] No source code, Terraform, GitHub configuration, DNS, or application
      setting references the old resource group.
- [ ] Required telemetry and operational artifacts are archived.
- [ ] A tested rollback window has completed without target regressions.

## Rollback Strategy

Until the deletion gates pass, keep the legacy resources unchanged and retain
the old resource IDs as a deploy-time rollback configuration.

If the target monitoring integration fails:

1. Restore the legacy resource IDs and legacy two-container response contract.
2. Redeploy the Terian backend.
3. Confirm `GET /api/metrics/awards` returns the baseline response.
4. Diagnose target identity, RBAC, telemetry, or metric issues without changing
   the legacy Award environment.

After the old resource group is deleted, rollback becomes a restore or rebuild,
not a configuration switch. Complete backups and validation before that point.

## Alternative Path: Migrate Terian Services into the New Subscription

This path evaluates removing the Terian Services workloads from
`rg_corporate` and `rg_platform` in the legacy subscription and rebuilding them
in subscription `2bb69129-5e74-44d9-af68-96d45633f667`.

### Validation Result

A direct Azure Resource Manager move is not available. The source and target
subscriptions belong to different Microsoft Entra tenants, while Azure requires
both subscriptions to use the same tenant for a cross-subscription resource
move. Moving the whole legacy subscription to the target tenant would affect
every resource in that subscription, delete its Azure role assignments, and
require managed identities and other tenant-bound configuration to be rebuilt.
That is outside the intended scope and is not recommended.

The viable form of this option is therefore a **blue/green rebuild and data
migration**:

1. Build a parallel Terian Services environment in the new subscription.
2. Copy or replicate application data and configuration.
3. Validate the new environment independently.
4. Cut over applications, identity, custom domains, and DNS.
5. Retain the legacy environment for a defined rollback window.
6. Delete `rg_corporate` and, after its separately owned services are resolved,
   `rg_platform`.

Relevant Microsoft guidance:

- [Move resources to another resource group or subscription](https://learn.microsoft.com/azure/azure-resource-manager/management/move-resource-group-and-subscription)
- [Resource move operation support](https://learn.microsoft.com/azure/azure-resource-manager/management/move-support-resources)
- [Transfer an Azure subscription to a different Entra directory](https://learn.microsoft.com/azure/role-based-access-control/transfer-subscription)
- [Managed identity limitations across directories](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identities-faq)

### Legacy Resource Inventory

`rg_corporate` contains the main Terian Services application stack:

| Area | Legacy resources | Migration treatment |
| --- | --- | --- |
| Compute | Container App and Container Apps environment | Rebuild and redeploy |
| Identity | User-assigned managed identity | Recreate in the target tenant and recreate RBAC |
| Images | Azure Container Registry | Build into a target registry; retain a rollback image if required |
| Data | Cosmos DB account with 12 application containers | Replicate or copy, validate, then cut over writes |
| Files and jobs | Storage account with eight blob containers and one queue | Copy blobs and drain or deliberately migrate the queue |
| Secrets | Key Vault with application secrets | Securely recreate; rotate credentials where practical |
| AI | Azure OpenAI resource with two deployments | Recreate or adopt shared target deployments after compatibility tests |
| Monitoring | Log Analytics, Application Insights, and alerts | Recreate; archive history if it must be retained |
| Frontends | Two Static Web Apps | Rebuild, validate, and rebind custom domains |

`rg_platform` is not just an application resource group. It contains shared and
externally visible ownership boundaries:

| Area | Legacy resources | Migration treatment |
| --- | --- | --- |
| Terraform state | `awardnomplatform/tfstate` | Create a new, non-conflicting target state; archive the old state after cutover |
| Authoritative DNS | `terian-services.com` Azure DNS zone | Copy every record and change registrar name servers during a controlled cutover |
| Domain registration | `terian-services.com` App Service Domain | Retain in a minimal old-subscription resource group or transfer through a supported registrar process |
| Legacy DNS | `terianix.ai` Azure DNS zone | Public DNS currently delegates to Cloudflare; verify no consumer before removal |
| Identity | Two CIAM directories | Migrate users/configuration or formally retire each directory; these are not workload resources that can simply be copied |
| Frontend | Legacy Terian Services Static Web App | Rebuild or retire after its domains are moved |

The `terian-services.com` DNS zone has website, Award environment, validation,
and Zoho mail records. A migration must copy and verify the complete zone, not
only the web records. Its zone also has a `CanNotDelete` lock associated with
the purchased domain. `rg_platform` must therefore be the last group considered
for deletion.

### Target Design Choices

There are two reasonable designs for the rebuilt stack.

#### Dedicated Target Stack

Recreate target equivalents for most resources currently in `rg_corporate`.
This minimizes application refactoring and gives Terian Services a clear
failure and ownership boundary. It also preserves more duplicated platform
cost and operational work.

#### Consolidated Terianix Stack

Add Terian Services as an application module in the Integrity Sentinel
infrastructure and reuse selected shared services such as the container
registry, Container Apps environment, Log Analytics workspace, Front Door,
and compatible Azure OpenAI deployments. Keep business data, secrets, and
application telemetry isolated unless a deliberate shared-data design is
approved.

This design has the stronger long-term cost and platform story, but it requires
more integration testing and makes shared capacity, naming, permissions, and
deployment ownership part of the migration.

The existing `rg_terianix_platform/stterianixtfstate` account is a suitable
target backend for a new Terian state key. The migration must start from a new
state rather than moving the existing state and applying it against another
subscription; the old and new environments need to coexist during validation.

### Required Data and Configuration Work

1. **Cosmos DB:** migrate all 12 containers while preserving partition keys,
   IDs, and required metadata. Choose either change-feed/dual-write replication
   or a short write freeze followed by a final delta copy. Compare counts and
   application-level reads before cutover.
2. **Storage:** copy all eight blob containers, validate object counts and
   checksums, stop producers, drain `engagement-intake`, and decide whether any
   outstanding queue messages should be replayed in the target.
3. **Key Vault:** recreate secrets without committing their values to source
   control. Prefer credential rotation over copying long-lived credentials.
4. **Container images:** rebuild from source into the selected target registry.
   Copying the full legacy tag history is unnecessary unless it is an explicit
   retention requirement.
5. **Monitoring:** create fresh workspaces, Application Insights components,
   alerts, and dashboards. Telemetry history does not move automatically.
6. **Identity and delivery:** create a target-tenant workload identity, recreate
   RBAC, update GitHub OIDC configuration, and change deployment environment
   variables to the target tenant, subscription, and resource names.
7. **Authentication:** replace old-tenant application registrations, redirect
   URIs, tenant IDs, and CIAM configuration. The legacy
   `acmenoms.onmicrosoft.com` dependency already has a separate target identity
   migration path; `RideshareDavid64.onmicrosoft.com` needs an ownership and
   retirement decision.

Several Azure resource names are globally unique. Parallel deployment will
require temporary or permanent new names for the registry, storage accounts,
Key Vault, Cosmos DB, and Azure OpenAI resource. Public names can be switched
only after target validation.

### Proposed Migration Sequence

1. Choose dedicated or consolidated target ownership and define the new
   Terraform state boundary.
2. Provision the target environment without modifying the legacy environment.
3. Recreate managed identities, RBAC, CI/CD federation, secrets, and monitoring.
4. Deploy the backend and frontends on their default target hostnames.
5. Copy the initial Cosmos DB and Storage data sets.
6. Run API, authentication, AI, file, queue, and frontend acceptance tests.
7. Freeze legacy writes or enable a controlled final synchronization; drain
   queues and reconcile data.
8. Rebind custom domains and switch authoritative DNS with reduced TTLs.
9. Observe the target while retaining a tested rollback route.
10. Remove `rg_corporate` only after all application and data gates pass.
11. Resolve Terraform state, domain registration, DNS, Static Web App, and both
    CIAM directories before removing `rg_platform`.

### Comparison of the Two Paths

| Decision factor | Monitoring-only migration | Full Terian rebuild in target subscription |
| --- | --- | --- |
| Immediate objective | Lets Terian read the new Award resources | Moves Terian Services itself to the new platform |
| Azure mechanism | Cross-tenant workload identity federation | Parallel rebuild, data migration, and cutover |
| Business data migration | None | Cosmos DB, blobs, queue state, and secrets |
| DNS/domain change | None for Terian | Required for both Terian domains and frontends |
| Authentication change | Monitoring credential only | CI/CD, managed identities, app registrations, and CIAM |
| Implementation risk | Lower | Higher |
| Time to delete old Award resource group | Shorter | Longer unless performed as an interim step |
| Long-term cross-tenant dependency | Remains for Award monitoring | Removed after Terian and Award are in the same tenant |
| Long-term consolidation | Limited | Strongest, especially with shared platform services |
| Rollback | Restore old resource IDs | DNS/application rollback plus data reconciliation |

### Recommendation

Do not attempt a direct resource-group move or a whole-subscription tenant
transfer.

If the immediate priority is deleting the costly legacy Award resource group,
complete the monitoring-only migration first. It is smaller, does not move
business data, and can provide value independently.

If Terian Services is strategically intended to become a native workload on
the Terianix platform, approve the full migration as a separate blue/green
program. Prefer the consolidated design after confirming shared Container Apps,
registry, OpenAI, networking, and Front Door requirements. Avoid a permanent
split in which compute moves but its data remains cross-tenant; that combines
the operational complexity of both paths without completing consolidation.

## Initial Status

As of October 9, 2026:

- Target Award infrastructure exists.
- The target Award API health endpoint is responding.
- Target backend and frontend Application Insights components exist.
- The target uses one Award API Container App and one shared Log Analytics
  workspace.
- Terian still reads the legacy Award resources.
- Cross-tenant monitoring authentication is not yet implemented.
- The Terian API and frontend still model primary and secondary Container Apps.
- Legacy tenant domains remain attached to the old Static Web App.
- Full Award application and routing cutover validation is not yet complete.
- The old Award resource group must not be deleted yet.
- Direct migration of `rg_corporate` and `rg_platform` is blocked by the
  subscriptions' different Entra tenants.
- The full Terian migration has been selected. The dedicated target stack in
  `rg_terian_services_prod` is provisioned, and platform resources use the
  existing `rg_terianix_platform` resource group.
- Slice 1 provisioning is complete and its Terraform plan reports no changes.
- Slice 2 implementation reuses the five resource-specific GitHub workflows on
  the `terianix-platform` branch. Target GitHub Environment setup, the browser
  CORS update, and application deployment remain to be run.
- See [Slice 2 deployment instructions](../terraform_terianix_platform/docs/SLICE_2_DEPLOYMENT.md).

