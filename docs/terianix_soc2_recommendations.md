# SOC 2 Compliance Recommendations
## Terianix Award Nomination System
**Terian Services Inc.**
*Document version 1.0 — July 2026*

---

## Overview

This document captures SOC 2 readiness recommendations for the Terianix Award Nomination System (ANS), a multi-tenant SaaS HR workflow application hosted on Microsoft Azure. The goal is to achieve SOC 2 Type I readiness in the near term and Type II certification over a 6–12 month audit observation window.

**Trust Service Criteria (TSC) in scope:**
- **Security** (CC) — required; the only mandatory criterion
- **Availability** (A) — SLA commitments to enterprise tenants
- **Confidentiality** (C) — sensitive employee nomination and HR data

**Stack context:** React/Vite frontend · Python FastAPI backend · Azure Container Apps · Azure SQL · Cosmos DB · Azure Service Bus · Azure Key Vault · Entra ID / Azure B2C · Application Insights · Grafana · GitHub Actions CI/CD · Terraform IaC

---

## Part 1 — Current Posture: What Is Already in Place

The following controls are already implemented and constitute audit-ready evidence. Each maps to one or more TSC categories.

### 1.1 Access Control
| Control | Implementation | TSC |
|---|---|---|
| JWT authentication | Entra ID tokens validated on every API request | CC6.1 |
| Per-tenant data isolation | tenantId partition key in Cosmos DB; row-level filtering in Azure SQL | CC6.3 |
| Managed Identity | No credentials in code; Container Apps use system-assigned MI for Key Vault and SQL | CC6.1 |
| Private endpoints | Internal services not exposed to public internet | CC6.6 |
| VNet integration | Service-to-service traffic stays within VNet | CC6.6 |

### 1.2 Encryption
| Control | Implementation | TSC |
|---|---|---|
| Encryption at rest | Azure SQL TDE enabled by default; Cosmos DB encrypted at rest | CC6.7 |
| Encryption in transit | TLS 1.2+ enforced via Azure Front Door; HTTPS-only on all Container App ingress | CC6.7 |
| Secret management | All secrets and connection strings in Azure Key Vault; no plaintext secrets in code or IaC | CC6.7 |

### 1.3 Availability & Monitoring
| Control | Implementation | TSC |
|---|---|---|
| Observability dashboard | 26-panel Grafana + Azure Monitor dashboard: API health, P95 latency, failure rates, queue depth, DB health | A1.2 |
| Distributed tracing | Application Insights with correlation IDs across Container Apps and Service Bus | A1.2 |
| Multi-region infrastructure | East US + West US deployment via Terraform IaC | A1.1 |
| KEDA autoscaling | Service Bus message count triggers Container App worker scaling | A1.2 |

### 1.4 Change Management
| Control | Implementation | TSC |
|---|---|---|
| CI/CD pipeline | GitHub Actions with GitHub Environments (production/development); secrets isolated per environment | CC8.1 |
| Infrastructure-as-Code | Terraform modular IaC; all infrastructure changes tracked in version control | CC8.1 |
| PR-based deployment | No direct pushes to main; changes require PR review before deployment | CC8.1 |

### 1.5 Fraud & Processing Integrity
| Control | Implementation | TSC |
|---|---|---|
| ML anomaly detection | Per-tenant Random Forest classifiers flag statistical anomalies in nomination patterns | PI1.4 |
| Graph pattern detection | Azure SQL Graph MATCH queries detect reciprocal rings, clique structures, approval-chain shortcuts | PI1.4 |
| Dead-letter queue recovery | Service Bus DLQ with replay tooling for failed message processing | PI1.2 |
| Idempotency table | Exactly-once processing guarantee for Service Bus consumers | PI1.2 |

---

## Part 2 — Gaps to Close

These are the controls auditors will look for that are not yet in place. Prioritized by audit impact.

---

### Gap 1 — Data Access Audit Log (CRITICAL)
**TSC:** CC6.1, CC6.2, CC7.2
**Why it matters:** Auditors require evidence that every access to sensitive data is logged and attributable to a specific user. Application Insights captures application events but not a structured, immutable record of who read which nomination record and when.

#### Recommended Implementation

**Step 1 — Create the audit log table in Azure SQL:**
```sql
CREATE TABLE dbo.AuditLog (
    Id              UNIQUEIDENTIFIER    DEFAULT NEWID() PRIMARY KEY,
    EventTime       DATETIME2           DEFAULT SYSUTCDATETIME() NOT NULL,
    TenantId        NVARCHAR(100)       NOT NULL,
    UserId          NVARCHAR(200)       NOT NULL,
    UserEmail       NVARCHAR(300)       NULL,
    Action          NVARCHAR(50)        NOT NULL,  -- READ | CREATE | UPDATE | DELETE | EXPORT | LOGIN | LOGOUT
    ResourceType    NVARCHAR(100)       NOT NULL,  -- Nomination | Award | Report | AdminSetting | UserAccount
    ResourceId      NVARCHAR(200)       NOT NULL,
    IpAddress       NVARCHAR(50)        NULL,
    UserAgent       NVARCHAR(500)       NULL,
    Outcome         NVARCHAR(20)        NOT NULL,  -- Success | Denied | Error
    AdditionalData  NVARCHAR(MAX)       NULL       -- JSON blob for context
);

-- Index for audit queries by tenant and time window
CREATE INDEX IX_AuditLog_Tenant_Time ON dbo.AuditLog (TenantId, EventTime DESC);
CREATE INDEX IX_AuditLog_User_Time   ON dbo.AuditLog (UserId, EventTime DESC);
```

**Step 2 — FastAPI middleware to auto-log all requests:**
```python
# middleware/audit_logger.py
from fastapi import Request
from datetime import datetime, timezone
import uuid

async def audit_log_middleware(request: Request, call_next):
    response = await call_next(request)
    
    # Extract from JWT claims (set by Entra ID auth middleware)
    user_id   = getattr(request.state, "user_id", "anonymous")
    tenant_id = getattr(request.state, "tenant_id", "unknown")
    
    await write_audit_event(
        tenant_id     = tenant_id,
        user_id       = user_id,
        user_email    = getattr(request.state, "user_email", None),
        action        = map_method_to_action(request.method),
        resource_type = extract_resource_type(request.url.path),
        resource_id   = extract_resource_id(request.url.path),
        ip_address    = request.client.host,
        user_agent    = request.headers.get("user-agent"),
        outcome       = "Success" if response.status_code < 400 else "Error"
    )
    return response

def map_method_to_action(method: str) -> str:
    return {"GET": "READ", "POST": "CREATE", "PUT": "UPDATE",
            "PATCH": "UPDATE", "DELETE": "DELETE"}.get(method, method)
```

**Step 3 — Log deployments as system audit events (GitHub Actions):**
```yaml
# .github/workflows/deploy.yml — add this step after deployment
- name: Log deployment to audit trail
  run: |
    curl -X POST ${{ secrets.API_BASE_URL }}/internal/audit \
      -H "Authorization: Bearer ${{ secrets.INTERNAL_API_KEY }}" \
      -d '{"action":"DEPLOY","resourceType":"Application","resourceId":"${{ github.sha }}","outcome":"Success"}'
```

**Retention policy:** Audit logs must be retained for a minimum of 12 months for SOC 2 Type II. Configure Azure SQL long-term retention or archive to Azure Blob Storage (Cool tier) after 90 days.

---

### Gap 2 — Periodic Access Reviews (HIGH)
**TSC:** CC6.2, CC6.3
**Why it matters:** SOC 2 requires evidence that access is reviewed periodically and that stale permissions are removed. Auditors will ask for documentation of at least two access reviews within the audit window.

#### Recommended Implementation

**Establish a quarterly access review process:**

1. Export current RBAC assignments from Azure:
```bash
# Run quarterly; export to version-controlled spreadsheet
az role assignment list --all --output table > access_review_$(date +%Y%m%d).txt
```

2. Review and document in a simple access review log (can be a Markdown file in a private repo):
```markdown
## Access Review — Q3 2026
**Date:** 2026-07-01
**Reviewer:** David Terian
**Scope:** All Azure subscriptions, GitHub org, Azure B2C admin roles

| Identity | Role | Resource | Status | Action Taken |
|---|---|---|---|---|
| alex@terian-services.com | Contributor | Terian-Dev-RG | Active — valid | No change |
| contractor-x@... | Reader | Terian-Prod-RG | Departed | Removed 2026-07-01 |

**Sign-off:** David Terian, Founder & CEO
```

3. For Azure B2C tenant: review admin accounts in the Azure portal quarterly and document findings.

**Offboarding checklist** (critical for auditors — must be documented):
- [ ] Revoke Entra ID / B2C access
- [ ] Remove GitHub org membership
- [ ] Rotate any shared secrets the individual had access to
- [ ] Document in offboarding log with date and approver

---

### Gap 3 — Incident Response Policy (HIGH)
**TSC:** CC7.3, CC7.4, CC7.5
**Why it matters:** Auditors require a written incident response policy and evidence it was followed for any incidents during the audit window.

#### Recommended Implementation

Create `docs/security/incident-response-policy.md` in your private repo:

```markdown
# Incident Response Policy
Terian Services Inc. — Terianix Award Nomination System
Effective: [Date] | Owner: David Terian, CEO

## Severity Levels
| Level | Definition | Response Time | Example |
|---|---|---|---|
| P0 — Critical | Production down or data breach | 15 min | All tenants inaccessible; unauthorized data access |
| P1 — High | Degraded performance or single-tenant impact | 1 hour | One tenant's scoring pipeline failing |
| P2 — Medium | Non-critical feature broken | 4 hours | Report export failing |
| P3 — Low | Minor bug, no data impact | Next sprint | UI cosmetic issue |

## Response Steps
1. **Detect** — alert fires in Grafana/Application Insights or reported by tenant
2. **Assess** — determine severity level; if P0 notify affected tenants within 1 hour
3. **Contain** — isolate affected service; roll back deployment if change-induced
4. **Investigate** — use distributed tracing and audit logs to establish timeline
5. **Remediate** — deploy fix through standard CI/CD pipeline
6. **Document** — complete incident report within 24 hours of resolution
7. **Review** — blameless postmortem for P0/P1 within 5 business days

## Data Breach Notification
If unauthorized access to tenant data is confirmed:
- Notify affected tenant(s) within 72 hours (GDPR standard; best practice even outside EU)
- Preserve all logs in immutable storage
- Engage legal counsel

## Incident Log
All incidents are recorded in `docs/security/incident-log.md` with date, severity, timeline, and resolution.
```

---

### Gap 4 — Vendor / Subprocessor Risk Management (MEDIUM)
**TSC:** CC9.2
**Why it matters:** SOC 2 auditors will ask for a list of vendors who process your tenant data and evidence you've assessed their security posture.

#### Recommended Implementation

Create `docs/security/subprocessor-register.md`:

```markdown
# Subprocessor Register
Last reviewed: [Date]

| Vendor | Service | Data Processed | SOC 2 / Cert | Link |
|---|---|---|---|---|
| Microsoft Azure | Infrastructure, compute, storage, auth | All tenant data | SOC 2 Type II | [Azure Compliance](https://learn.microsoft.com/en-us/azure/compliance/) |
| Azure OpenAI | AI agent completions | Query text (no PII in prompts by design) | SOC 2 Type II | Same |
| GitHub | Source code, CI/CD | Source code only; no tenant data | SOC 2 Type II | [GitHub Compliance](https://github.com/security) |
| Grafana Labs (if cloud) | Dashboards | Metrics only; no PII | SOC 2 Type II | [Grafana Security](https://grafana.com/security/) |

**Review cadence:** Annually or when a new subprocessor is added.
```

---

### Gap 5 — Security Awareness Training (LOW — but auditors check)
**TSC:** CC1.4
**Why it matters:** Even as a small team, SOC 2 auditors want evidence that personnel with access to production systems have completed security awareness training.

#### Recommended Implementation

- Complete a free or low-cost annual security awareness course (KnowBe4, SANS, or even a documented self-study of OWASP Top 10)
- Document completion in a training log:

```markdown
# Security Training Log

| Name | Role | Training | Completion Date | Notes |
|---|---|---|---|---|
| David Terian | Founder/CEO | OWASP Top 10 self-study + Azure Security Fundamentals | 2026-01-15 | Renewed annually |
| Alex Heifetz | Sr. Integration Architect | Same | 2026-02-01 | Completed prior to production access |
```

---

## Part 3 — SOC 2 Compliance Dashboard

Add these four panels to your existing Grafana / Azure Monitor dashboard as a dedicated **Compliance** tab.

### Panel 1 — Failed Authentication Attempts (Access Control)
```kusto
// Application Insights — failed auth by tenant, hourly
requests
| where timestamp > ago(24h)
| where resultCode in ("401", "403")
| extend TenantId = tostring(customDimensions["tenant_id"])
| summarize FailedAttempts = count() by TenantId, bin(timestamp, 1h)
| order by FailedAttempts desc
```

### Panel 2 — Data Access Volume by Tenant (Audit Coverage)
```kusto
// Custom events from audit log middleware
customEvents
| where timestamp > ago(24h)
| where name == "AuditEvent"
| extend TenantId  = tostring(customDimensions["tenant_id"])
| extend Action    = tostring(customDimensions["action"])
| summarize EventCount = count() by TenantId, Action, bin(timestamp, 1h)
```

### Panel 3 — Uptime SLA Tracker (Availability)
```kusto
// Rolling 30-day uptime percentage
requests
| where timestamp > ago(30d)
| summarize
    Total  = count(),
    Failed = countif(success == false)
| extend UptimePct = round((1.0 - (todouble(Failed) / Total)) * 100, 3)
| project UptimePct, Total, Failed
```

### Panel 4 — Key Vault Secret Access Log (Encryption / Access Control)
```kusto
// Azure Diagnostics — Key Vault operations
AzureDiagnostics
| where ResourceType == "VAULTS"
| where OperationName in ("SecretGet", "SecretSet", "SecretDelete")
| where TimeGenerated > ago(7d)
| summarize OperationCount = count() by OperationName, CallerIPAddress, bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

---

## Part 4 — Recommended Implementation Roadmap

### Phase 1 — Immediate (2–4 weeks)
- [ ] Implement `AuditLog` table in Azure SQL
- [ ] Add audit log middleware to FastAPI
- [ ] Write Incident Response Policy document
- [ ] Conduct and document first Access Review
- [ ] Create Subprocessor Register
- [ ] Add Compliance tab to Grafana dashboard (four panels above)

### Phase 2 — Near-term (1–3 months)
- [ ] Establish quarterly access review cadence (calendar reminder + template)
- [ ] Document security awareness training for all personnel with production access
- [ ] Configure 12-month audit log retention (Azure SQL LTR or Blob archive)
- [ ] Write System Security Plan (SSP) — one-page description of your security controls for prospective tenants and auditors
- [ ] Engage a SOC 2 readiness consultant for gap assessment (~$5–10K)

### Phase 3 — Type I Audit (3–6 months)
- [ ] Engage a licensed CPA firm for SOC 2 Type I audit (~$15–30K)
- [ ] Compile evidence package: policy documents, access review logs, incident log, audit log samples, architecture diagram
- [ ] Type I report issued — point-in-time attestation of control design

### Phase 4 — Type II Observation Window (6–12 months post-Type I)
- [ ] Controls operate continuously through the observation window
- [ ] Grafana compliance dashboard provides continuous evidence collection
- [ ] Quarterly access reviews documented
- [ ] Any incidents documented with postmortems
- [ ] Type II audit — covers the full observation period

---

## Part 5 — Evidence Package Checklist

When you engage an auditor, you will need to provide:

| Evidence Item | Source | Status |
|---|---|---|
| Network diagram showing VNet, private endpoints, Front Door | Terraform IaC / draw.io | To create |
| RBAC assignment export | `az role assignment list` | To document |
| Access review log (2+ reviews for Type II) | `docs/security/access-review-log.md` | To create |
| Incident response policy | `docs/security/incident-response-policy.md` | To create |
| Incident log (all P0–P2 incidents in window) | `docs/security/incident-log.md` | To create |
| Subprocessor register | `docs/security/subprocessor-register.md` | To create |
| Security training log | `docs/security/training-log.md` | To create |
| Audit log table schema + sample data | Azure SQL | Gap — implement |
| CI/CD pipeline configuration | GitHub Actions YAML | Already in place |
| Terraform IaC showing Key Vault + Managed Identity | GitHub repo | Already in place |
| Grafana compliance dashboard screenshot | Grafana | To add panels |
| Azure Key Vault diagnostic logs | Azure Monitor | Enable diagnostics |
| Uptime report (30/90-day) | Application Insights | Already available |

---

## Appendix — SOC 2 TSC Reference Map

| TSC Code | Description | Primary Controls in ANS |
|---|---|---|
| CC6.1 | Logical access controls | Entra ID JWT, Managed Identity, Key Vault |
| CC6.2 | Access provisioning / deprovisioning | RBAC, offboarding checklist |
| CC6.3 | Role-based access | Per-tenant isolation, scoped tokens |
| CC6.6 | Network security | Private endpoints, VNet, Front Door |
| CC6.7 | Encryption at rest and in transit | Azure SQL TDE, TLS, Key Vault |
| CC7.2 | Monitoring for anomalies | Application Insights, Grafana, fraud detection layer |
| CC7.3 | Incident response | Incident Response Policy |
| CC8.1 | Change management | GitHub Actions CI/CD, Terraform IaC, PR reviews |
| CC9.2 | Vendor risk management | Subprocessor Register |
| A1.1 | Infrastructure availability | Multi-region (East US / West US) |
| A1.2 | Performance monitoring | 26-panel observability dashboard |
| PI1.2 | Processing completeness | Idempotency table, DLQ recovery |
| PI1.4 | Processing accuracy | ML fraud detection, graph anomaly detection |
| C1.1 | Confidentiality classification | Per-tenant data isolation, audit logging |

---

*Document owner: David Terian, Founder & CEO, Terian Services Inc.*
*Next review: October 2026*
