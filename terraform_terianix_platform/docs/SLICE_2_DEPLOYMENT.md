# Slice 2: Deploy Terian Services to the Target Platform

Slice 1 has completed target infrastructure provisioning. Terraform currently
reports no changes. Slice 2 deploys the application code and versioned assets
and validates the Azure-provided hostnames before data or domain cutover.

## Branch and Environment

The migration branch is `terianix-platform`. All five existing workflows now
support it and retain their independent path filters:

| Workflow | Source path | Target action |
| --- | --- | --- |
| `deploy-backend.yml` | `backend/**` | Build image, deploy backend, check health and CORS |
| `deploy-swa.yml` | `frontend/**` | Build and deploy the Terian Services frontend |
| `deploy-terianix-swa.yml` | `terianix_frontend/**` | Build and deploy the Terianix frontend |
| `deploy-prompts.yml` | `ai_prompts/**` | Upload prompts and restart active backend revisions |
| `deploy-blob-templates.yml` | `blob_templates/**` | Upload templates only |

Each workflow also runs when its own YAML file changes. Backend and prompt
deployments share a concurrency group so they do not update the same backend
at the same time. Template uploads do not deploy or restart compute.

| Branch | GitHub Environment | Azure target |
| --- | --- | --- |
| `main` | `prod` | Existing legacy configuration |
| `terianix-platform` | `terianix-platform-prod` | New Terianix subscription |

For Azure login, migration runs use the new environment's Azure ID variables.
Legacy runs continue using the existing Azure ID secrets. The frontend
workflows read API URLs and telemetry from their selected environment, and
deployment tokens remain environment secrets.

The initial push of the migration branch changes all five workflow files, so
all five workflows can run on that first push. Subsequent asset-only pushes
only run their matching workflow.

## Apply Browser Origins

The deployed frontend hostnames are:

- `https://calm-plant-0158e0a0f.5.azurestaticapps.net`
- `https://zealous-rock-0c92ed20f.2.azurestaticapps.net`

These origins have been added to the ignored local `terraform.tfvars` under
`pre_cutover_frontend_origins`. The backend module combines them with the
existing production domain origins. They are explicit values to avoid a
dependency cycle between frontend creation and backend configuration.

Run these commands yourself from the target Terraform environment:

```powershell
Set-Location C:\Users\David\source\repos\Terian_Services\terraform_terianix_platform\environments\prod
terraform plan '-out=terraform.tfplan'
terraform apply 'terraform.tfplan'
```

The resource change should be an in-place update of the target Container App's
`TERIAN_ALLOWED_ORIGINS` setting. Investigate unexpected replacement or
deletion actions before proceeding. If the SWAs are recreated, update the
origins from their new hostname outputs before deploying.

## Configure the GitHub Environment

Connect Azure CLI to the target subscription and authenticate GitHub CLI with
access to repository environments, variables, and secrets. From the repository
root, inspect the proposed configuration with:

```powershell
.\scripts\configure-terianix-platform-github.ps1 -WhatIf
```

Then configure the target environment:

```powershell
.\scripts\configure-terianix-platform-github.ps1
```

The script reads existing Terraform outputs and target Azure resources. It
validates the subscription, tenant, GitHub federation subject, and frontend
hostnames, then sets:

- Azure client, tenant, and subscription ID variables.
- Registry, backend application, resource group, and storage variables.
- Both frontend API URLs and target Application Insights connection strings.
- Both frontend deployment-token secrets, passed directly to GitHub without
  displaying or saving the token values.

A newly created environment permits the `terianix-platform` and `main`
branches. Existing reviewer and protection rules are retained. Existing
custom branch rules gain the two required branches; other existing branch
policy types are preserved and should be checked in GitHub's settings.

The script does not run Terraform init, plan, or apply, push code, or dispatch
deployment workflows. It only configures the target GitHub Environment.

## First Deployment

Configure the environment before pushing the migration branch:

```powershell
git push -u origin terianix-platform
```

Commit the workflow, setup-script, documentation, and target Terraform changes
before the push; the local `terraform.tfvars` remains excluded from Git.

After all five workflows succeed, open the two target frontend URLs and verify
that their requests use the target API. Backend health checks use
`GET /api/health`, and CORS checks use preflight requests from both target
frontend origins.

The new backend workflow checks health and browser access only. It does not
prove that Cosmos business data has been copied, every application feature
works, mail credentials are configured, or OpenAI and Serper calls succeed.
Those checks follow deployment and data migration.

## Completion Evidence

- [ ] Target GitHub Environment is configured.
- [ ] Backend image is the application image rather than the bootstrap image.
- [ ] Both frontend workflows deploy successfully to their target SWAs.
- [ ] Prompt and template workflows upload to `stterianixservicesprod`.
- [ ] `GET /api/health` returns `{"status":"ok"}`.
- [ ] Backend preflight responses allow both target frontend origins.
- [ ] Both frontends use the target API and their own target telemetry component.
- [ ] Browsing the target hosts does not redirect to a legacy hostname.

Domain registration, authoritative DNS, production custom-domain bindings,
business data copying, and CIAM migration are subsequent slices.
