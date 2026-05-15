# Company Info Skill — Terian Services

This skill is the canonical summary of what Terian Services does, sells,
delivers, and stands for. Treat every statement here as authoritative when
answering visitor questions about the company.

---

## At a glance

- **Name:** Terian Services
- **Tagline:** *AI-empowered enterprise software and data analytics.
  Secure. Isolated. Provable.*
- **Type:** Boutique engineering firm (small, senior-engineer-led)
- **Founder:** David Terian
- **Hosting:** Microsoft Azure, primary region **West US 2**
  (EU / UK / Canada landing zones available on request for regulated workloads)
- **Website:** https://terian-services.com
- **Demo product:** https://demo-awards.terian-services.com

## Mission

Terian Services builds AI/ML-empowered SaaS and delivers AI analytics,
integrity & fraud detection, and cloud modernization for the enterprise.
Every product shipped and every engagement delivered is built around three
commitments:

- **Secure** — encrypted, least-privilege, threat-monitored. Defense-in-depth
  from identity through application.
- **Isolated** — hard tenant boundaries enforced at the database, identity,
  and network layers. Customer data never crosses into another tenant's
  compute or storage.
- **Provable** — full audit trail of every change, approval, and model
  decision. Exportable, reviewable, defensible.

## Why customers pick Terian (three pillars used across the site)

- **Engineering-led.** Senior engineers from day one. No offshore handoff,
  no junior shadow team. The people writing the code are the people on
  the call.
- **Azure-native.** Built on Azure AD / Entra ID, Workday, Microsoft Graph,
  and the Microsoft data stack so adoption is friction-free across the
  customer's tenant.
- **Outcome-anchored.** Every engagement starts with the metric being
  moved and ends with proof that it moved. No vanity dashboards, no dead
  reports.

---

## Products (SaaS we build, host, and operate)

### Award Nomination System  (live, flagship)

URL: https://terian-services.com/products/award-nomination

Streamlined peer recognition and manager-led award workflows for enterprise
HR. Configurable nomination forms, multi-step approval chains (manager →
skip-level → HRBP → Comp partner), real-time dashboards by status / category
/ business unit, full audit trail of every state change.

**AI/ML layer** — the differentiator:

- **Bias detection** — cohort-aware analysis of who's nominating whom;
  surfaces under-recognized groups before they become a retention risk.
- **Collusion & gaming** — graph analysis of nomination flows surfaces
  reciprocal patterns, ring structures, and approval shortcuts.
- **Anomaly flagging** — statistical and embedding-based models flag
  nominations that deviate from organizational norms (wrong category,
  suspicious timing, copied language).
- **Decision provenance** — every flag is traceable to the model version
  and inputs that produced it, with explanation layers reviewable in the
  HRBP queue. Tenant-isolated — your data never trains another customer's
  model.

**Integrations:** Microsoft Azure AD / Entra ID, Workday Compensation
(approved awards flow in as one-time payment events), Microsoft Graph,
Microsoft Teams.

**How it works:** Nominate → Approve → Audit → Pay.

### Integrity Sentinel  (coming soon, on the roadmap)

URL: https://terian-services.com/products/integrity-sentinel

Productized fraud-detection SaaS — multi-tenant, configurable rule engine
plus ML models for transactions, vendor master, and expense data. Out-of-
the-box detections for vendor collusion, duplicate payments, ghost vendors,
expense threshold-tuning, segregation-of-duties violations. Connectors
planned for Workday, Microsoft Dynamics, NetSuite, SAP, plus CSV. Pilot
opening in 2026.

---

## Services (engineering and analytics delivered to clients)

For services engagements, Terian typically operates **inside the client's
Azure tenant**, under MSA (Master Services Agreement) and DPA (Data
Processing Agreement). Sensitive client data does not leave the client
environment.

### AI Analytics — `/services/ai-analytics`
Custom ML models and analytics workflows on enterprise data: forecasting,
classification, anomaly detection, NLP on unstructured text,
embedding-based search, generative AI integration with retrieval, evals,
and guardrails. Stack: Azure ML / Azure AI Foundry, Azure OpenAI, Microsoft
Fabric / Synapse, Databricks, Hugging Face, LangChain / LlamaIndex, MLflow.

### Integrity & Fraud Detection — `/services/integrity-fraud`
Systemic, business-process-aware fraud detection. Four layers working
together: rule engines, statistical anomaly detection, graph analysis, and
ML models. Surfaces collusion, ghost vendors, duplicate payments, expense
& benefit abuse. Three-phase engagement: 2-week risk assessment → 6–8 week
fixed-price pilot → production deployment with retraining cadence and
investigator workflow.

### Data Mining — `/services/data-mining`
Pattern discovery on operational, financial, and HR datasets. Methods:
feature extraction, segmentation, association/sequence mining, driver
analysis (regression, gradient boosting, SHAP). Deliverables: written
findings memo, interactive dashboards (Power BI / Fabric / Looker), and
a versioned feature pipeline.

### Datacenter → Cloud Migration — `/services/cloud-migration`
Azure-first, Terraform-driven migration programs. Covers the full
spectrum of the 6 R's (rehost / replatform / refactor / repurchase /
retire / retain). Five-phase method: Assess → Design → Migrate → Optimize
→ Operate. Wave-based execution, rehearsed rollback, FinOps optimization.
Stack: Terraform / Bicep, Azure Migrate, Azure Arc, Azure Landing Zones,
Azure Monitor, Defender for Cloud, GitHub Actions / Azure DevOps.

### MLOps & Model Governance — `/services/mlops`  *(now booking pilots)*
The boring, durable infrastructure that keeps models trustworthy in
production: model registry, drift monitoring, evaluation harnesses,
responsible-AI review (bias audits, explanation layers, model cards).

---

## Engagement model (services)

1. **Discovery (1–2 weeks)** — half-day workshop, data access review,
   baseline metric. Written scope, success criteria, fixed-price pilot
   proposal.
2. **Pilot (4–8 weeks)** — fixed-price, time-boxed, production-shaped from
   day one. No throwaway demos.
3. **Production & operate** — hand-off package, runbooks, monitoring.
   Optional ongoing engagement for tuning, governance, new use cases.

---

## Trust, security, and compliance posture

Detailed page: https://terian-services.com/trust

**Identity** — Microsoft Azure AD / Entra ID for all user authentication,
SSO and MFA enforced, B2B guest access for partners and demo environments
(invitation-only, time-bound).

**Encryption** — at rest (Azure-managed keys; customer-managed keys on
request) and in transit (TLS 1.2+ everywhere). Secrets in Azure Key Vault.

**Defense in depth** — layered controls (identity → network → data →
application): WAF, private endpoints, RBAC, runtime monitoring.

**Tenant isolation** — per-tenant database schemas (or separate databases
for higher tiers), row-level security, identity-scoped storage paths. ML
models are tenant-isolated — your data never trains a model used elsewhere.

**Least privilege by default** — RBAC with no standing admin; just-in-time
elevation via Azure Privileged Identity Management (PIM); service
principals scoped to the smallest possible permission set.

**Confidentiality of inference** — for AI features, prompts, embeddings,
and inputs are not used to train cross-tenant models. LLM calls go through
tenant-scoped endpoints with logging the customer controls.

**Audit trail (provable)** — every nomination, approval, model flag, and
configuration change captured with actor, timestamp, and prior/next state.
Exportable for SOX, internal audit, and regulator review.

**Data sovereignty** — primary region Azure West US 2. Customer data
stays in the elected region. EU / UK / Canada landing zones available on
request for regulated workloads.

**Compliance** — Terian inherits the Microsoft Azure compliance posture
(SOC 2, ISO 27001, HIPAA, FedRAMP — see Microsoft Trust Center). For
Terian-owned products, the company is working toward independent **SOC 2
Type II attestation**. Specific control documentation is available under
NDA. Vulnerability reports: `security@terian-services.com` (acknowledged
within one business day).

---

## How to get in touch

- **General / demo requests:** `sales@terian-services.com`
- **Technical support:** `support@terian-services.com`
- **Security & vulnerability reports:** `security@terian-services.com`
- **Contact form:** https://terian-services.com/contact
- **Live Award Nomination demo:** https://demo-awards.terian-services.com
  (self-registration, Microsoft Azure AD B2B guest sign-in)

---

## Frequently asked questions — quick answers

- **Are you hiring?** — Not actively listed; interested engineers can email
  `sales@terian-services.com` and the message will be routed.
- **What does pricing look like?** — Engineering services are scoped per
  engagement (fixed-price pilots, then ongoing as agreed). Product pricing
  is not publicly listed; request a quote via `sales@terian-services.com`.
- **Do you do custom development?** — Yes, that's the core of the services
  business. Start with a discovery conversation.
- **What's your typical engagement size?** — Pilots are 4–8 weeks,
  fixed-price. Larger programs (cloud migration, full ML platform builds)
  scope at discovery.
- **Do you operate outside the US?** — Hosting is currently West US 2 with
  EU / UK / Canada landing zones available on request. Services engagements
  are tenant-resident, so geography follows the customer's tenant.
- **Are you SOC 2 certified?** — Inherited posture via Azure today; working
  toward independent SOC 2 Type II. Ask sales for the current attestation
  letter or readiness status.
