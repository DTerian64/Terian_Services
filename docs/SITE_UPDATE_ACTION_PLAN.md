# Terian Services — Corporate Site Update Action Plan

**Status:** Draft v1
**Owner:** David Terian
**Last updated:** May 2026

---

## 1. Strategic Positioning

### One-liner
Terian Services builds **AI/ML-empowered enterprise software** and delivers **data, integrity, and cloud-modernization services** that turn operational complexity into measurable outcomes.

### Elevator pitch (3 sentences)
Terian Services specializes in AI/ML-assisted SaaS products and high-trust enterprise services. We ship Azure-native applications such as our Award Nomination System, and we partner with mid-market and enterprise clients on AI analytics, systemic integrity & fraud detection, data mining, and datacenter-to-cloud migration. Every engagement is built on the same engineering DNA: secure-by-default, measurable, and grounded in real production constraints.

### Three pillars (use across the site)
1. **Products** — AI/ML-empowered SaaS we own and operate.
2. **Services** — Hands-on engineering and analytics delivered to clients.
3. **Migrations & Modernization** — Datacenter-to-cloud transformation programs.

---

## 2. Product & Service Taxonomy

### 2.1 Products (we build, host, and sell)

| Product | Status | One-line description |
|---|---|---|
| **Award Nomination System** | Live (flagship) | AI/ML-assisted enterprise recognition platform — peer/manager nominations, approval workflows, audit trail, Workday + Azure AD native. ML layer surfaces anomalous nomination patterns, detects bias, and flags potential fraud or collusion. |

### 2.2 Services (we deliver to clients)

| Service | Description |
|---|---|
| **AI Analytics** | Custom ML models and analytics workflows on enterprise data — forecasting, classification, anomaly detection, NLP on unstructured text, embedding-based search. |
| **Integrity & Fraud Detection** | Systemic, business-process-aware fraud detection. Combines rule engines, statistical anomaly detection, graph analysis, and ML models to surface collusion, duplicate-payment, ghost-vendor, and benefit-abuse patterns. |
| **Data Mining** | Discovery analytics on operational, financial, and HR datasets. Feature extraction, segmentation, pattern discovery, and dashboarding. |
| **Datacenter-to-Cloud Migration** | Lift-and-shift through full re-platforming. Azure-first, with assessment, landing-zone design, IaC (Terraform), data migration, cutover, and post-migration optimization. |

### 2.3 Future products & services (roadmap candidates)

Mark these on the site as **"Coming soon"** or **"On our roadmap"** so they signal direction without overpromising.

**SaaS product candidates**
- **Integrity Sentinel** — productized fraud-detection SaaS that packages our services-level engagements into a multi-tenant platform (transactions, vendor master, expense reports).
- **AI Compliance Copilot** — RAG-based assistant for policy lookup, control mapping (SOC 2 / ISO 27001 / HIPAA), and audit-prep.
- **Recognition Insights Add-on** — analytics module for the Award Nomination System: bias detection, recognition equity dashboards, retention correlation.
- **Workforce Signal** — passive, privacy-preserving signals (engagement, attrition risk) derived from existing HR/Workday data.
- **Cloud Cost Sentinel** — anomaly detection and rightsizing for Azure spend.

**Services candidates**
- **MLOps & Model Governance** — model registry, drift monitoring, evaluation harnesses, responsible-AI review.
- **Data Platform Engineering** — Lakehouse / Fabric / Synapse / Databricks builds.
- **Identity & Access Modernization** — Azure AD / Entra ID consolidation, B2B/B2C, conditional access design.
- **Generative AI Integration** — bringing LLMs into existing line-of-business apps with retrieval, evals, and guardrails.
- **Compliance & Audit Readiness** — SOC 2, ISO 27001, HIPAA pre-audit engagements.
- **Custom Enterprise Software** — bespoke internal platforms for HR, finance, and operations teams.
- **Staff Augmentation** — embedded senior engineers for short-term capacity needs.

---

## 3. Information Architecture (proposed)

```
/                                  Home (refreshed)
/products/                         Products index
/products/award-nomination/        (rename of /award_nomination)
/products/integrity-sentinel/      Coming-soon page
/services/                         Services index (NEW)
/services/ai-analytics/            NEW
/services/integrity-fraud/         (extends current /systemic_fraud_detection)
/services/data-mining/             NEW
/services/cloud-migration/         NEW
/services/mlops/                   NEW (roadmap)
/about/                            Refresh
/contact/                          Refresh (add form)
/privacy/                          Keep, minor copy refresh
/blog/ or /insights/               NEW (optional, phase 2)
```

### Header navigation changes

Update `frontend/src/components/Header.tsx`:

```ts
const PRODUCT_ITEMS: MenuItem[] = [
  { label: "Award Nomination System", href: "/products/award-nomination" },
  { label: "Integrity Sentinel (Coming Soon)", href: "/products/integrity-sentinel" },
];

const SERVICE_ITEMS: MenuItem[] = [
  { label: "AI Analytics",                  href: "/services/ai-analytics" },
  { label: "Integrity & Fraud Detection",   href: "/services/integrity-fraud" },
  { label: "Data Mining",                   href: "/services/data-mining" },
  { label: "Datacenter → Cloud Migration",  href: "/services/cloud-migration" },
  { label: "MLOps & Model Governance",      href: "/services/mlops" },
];
```

Rename the current "Solutions" dropdown to **"Services"** (clearer to enterprise buyers, matches taxonomy above). Keep "Products" dropdown.

Add routing entries in `App.tsx` for each new path; keep redirects from old URLs (`/award_nomination` → `/products/award-nomination`, `/systemic_fraud_detection` → `/services/integrity-fraud`).

---

## 4. Page-by-Page Action Items

### 4.1 Home (`HomePage.tsx`) — **Major rewrite**

Current copy is 100% Award-Nominations-centric ("Enterprise HR Automation, Simplified"). It needs to elevate to a parent-company narrative.

**Changes:**
- **Hero headline:** "AI-empowered enterprise software & services" with sub-headline "We build SaaS products and deliver AI analytics, integrity & fraud detection, and cloud modernization for enterprise teams."
- **Primary CTA:** keep "Request a Demo" but add a secondary "Talk to Engineering" mailto.
- **Replace 3-tile feature grid** with a **two-row grid**:
  - Row 1 — Products (1–2 tiles): Award Nomination System, Integrity Sentinel (Coming Soon).
  - Row 2 — Services (4 tiles): AI Analytics, Integrity & Fraud Detection, Data Mining, Cloud Migration.
- **Add a "Why Terian" strip** below the tiles: 3 short value props (Engineering-led, Azure-native, Outcome-anchored).
- **Add a logo/marquee placeholder** for future client logos.
- **Footer:** add columns for Products / Services / Company / Legal.

### 4.2 About (`AboutPage.tsx`) — **Expand**

Currently a single sentence. Expand into:
- Mission paragraph (2–3 sentences).
- "What we do" — 3 cards mirroring the three pillars.
- "How we work" — values: Security by default, Measure everything, Ship in production, Right-size the solution.
- Founder / leadership block (optional, even just a paragraph about David's background to start).
- Simple stats strip if/when available (years in business, awards processed, clients served).

### 4.3 Contact (`ContactPage.tsx`) — **Add form + segmentation**

- Replace single email with a real contact form (name, work email, company, inquiry type, message). Inquiry type drop-down: Product demo / Services consultation / Partnership / Press / Other.
- Backend: route through Azure Static Web Apps API or a Logic App that emails `support@terian-services.com`. Include reCAPTCHA / Cloudflare Turnstile.
- Add direct contacts: sales@, support@, security@.
- Add office/region info (West US 2 hosting region is already public; consider a "where we are" line).

### 4.4 Award Nomination (`AwardNominationPage.tsx`) — **Major rewrite**

Currently 1 sentence. Expand to a real product page:
- Hero with product screenshot/illustration.
- "What it does" — 4–6 feature blocks (peer & manager nominations, approval chains, audit trail, Workday integration, Azure AD SSO, real-time dashboards).
- **AI/ML section** — call out the ML layer explicitly: anomaly/fraud detection on nomination patterns, bias detection, recognition equity insights.
- "How it works" — 4-step diagram (Nominate → Approve → Audit → Pay).
- Integrations strip (Azure AD, Workday, Microsoft Graph, Teams).
- Security & compliance block (Azure AD B2B, encryption at rest/transit, region: West US 2).
- Pricing teaser ("Contact for enterprise pricing").
- CTA: Request demo + Download one-pager (PDF).

### 4.5 Systemic Fraud Detection → Integrity & Fraud Detection — **Rewrite & relocate**

Move from `/systemic_fraud_detection` (Solutions) to `/services/integrity-fraud` (Services). Redirect old URL.

Expand the page to cover:
- The problem (collusion, ghost vendors, duplicate payments, benefit abuse, expense fraud).
- Our methodology: rule engines + statistical anomaly detection + graph analysis + ML.
- Engagement model (assessment → pilot → production deployment).
- Sample outputs (anonymized risk-scored transactions, network graphs).
- Industries served (HR, finance, procurement, healthcare claims).
- Outcomes / KPIs we target (% of fraudulent dollars surfaced, false-positive rate, payback period).
- CTA: Book a 30-minute fraud-risk discovery call.

### 4.6 NEW — Services index (`/services/`)

A landing page with a card per service, each linking to its detail page. Mirrors the Products index pattern.

### 4.7 NEW — AI Analytics service page

Sections: Capabilities, Sample use cases (forecasting, churn, NLP, embedding search), Tech stack (Azure ML, Databricks, OpenAI, Hugging Face), Engagement model, FAQ.

### 4.8 NEW — Data Mining service page

Sections: What it covers (operational, financial, HR datasets), Methods (feature extraction, segmentation, pattern discovery), Deliverables (dashboards, models, documented findings), Sample engagements (anonymized).

### 4.9 NEW — Datacenter → Cloud Migration service page

Sections: Migration spectrum (rehost / replatform / refactor / repurchase / retire / retain), Our 5-phase method (Assess → Design → Migrate → Optimize → Operate), Azure-first stack (Terraform, Bicep, Azure Migrate, Azure Arc), Risk & rollback approach, Case-study placeholder.

This page should also reference Terian's existing Terraform-based deployment of this very site as a credibility cue.

### 4.10 NEW — MLOps & Model Governance (roadmap)

Sections: Why MLOps, Capabilities (model registry, drift monitoring, eval harnesses, responsible-AI review), Reference architecture diagram. Mark as "Now booking pilots."

### 4.11 NEW — Integrity Sentinel (coming-soon product page)

Lightweight teaser page: problem, planned feature set, "Get notified at launch" email capture.

### 4.12 Privacy (`PrivacyPage.tsx`) — **Light refresh**

- Update "Effective date".
- Broaden scope from "Demo Award Nominations" to cover all Terian-operated sites and demo environments.
- Add a section on services engagements (we typically process client data inside the **client's** Azure tenant, not ours; we sign MSAs/DPAs).
- Add cookie statement if any analytics are added.

---

## 5. Cross-cutting Updates

### 5.1 Brand & visual

- Lock down brand palette in `tailwind.config.js` (currently teal `#2ab8a8`, indigo `#4f46e5`, sky `#0369a1`). Add semantic tokens: `brand.primary`, `brand.accent`, `brand.product`, `brand.service`.
- Pick a single typography stack (currently mixes Arial inline styles with Tailwind defaults). Recommend: Inter for body, system stack fallback.
- Replace inline-style components (Home, Privacy) with Tailwind classes for consistency.
- Add a real OG image (`/og-image.png`) and favicon set.

### 5.2 SEO & metadata

- Per-page `<title>` and `<meta name="description">`. Currently driven from a single `index.html`.
- Add `react-helmet-async` (or move to a metadata-aware framework later) for per-route head tags.
- Generate `sitemap.xml` and `robots.txt`.
- Add JSON-LD `Organization` schema on Home and `Service` schema on each service page.

### 5.3 Routing

- Current SPA uses raw `window.location.pathname` switching in `App.tsx`. With the page count growing to ~12, migrate to `react-router-dom` (or `wouter` for smaller bundle). Configure Azure Static Web App `staticwebapp.config.json` fallback to `/index.html`.

### 5.4 Analytics & lead capture

- Add Plausible or Microsoft Clarity (privacy-friendly).
- Wire contact form submissions to a CRM-light store (Azure Table Storage or HubSpot free tier).
- Track CTA clicks as events (Demo, Talk to engineering, Service inquiry).

### 5.5 Compliance & trust

- Add a `/trust` or `/security` page summarizing: Azure-native hosting, encryption, Azure AD B2B, region (West US 2), data residency, incident contact (`security@`).
- Reference any in-progress certifications (SOC 2 readiness, etc.) — only if accurate.

### 5.6 Performance & quality

- Add Lighthouse CI step in build.
- Add `eslint --max-warnings 0` and `tsc --noEmit` to CI.
- Add a basic Playwright smoke test (Home loads, each nav link reaches a 200 page).

### 5.7 Infrastructure

- Update `terraform/modules/static-web-app` to enable custom domain SSL and route fallback config.
- Confirm `staticwebapp.config.json` includes the new route redirects (old → new URLs).
- Add CSP headers via `staticwebapp.config.json`.

---

## 6. Copy Snippets (drop-in starters)

### Hero (Home)
> **AI-empowered enterprise software & services.**
> We build production SaaS, deliver AI analytics and integrity & fraud detection, and modernize datacenter workloads on Azure. Engineering-led, secure by default, anchored to outcomes you can measure.

### Why Terian (3 short blocks)
- **Engineering-led.** Senior engineers from day one — no offshore handoff, no junior shadow team.
- **Azure-native.** We build on Azure AD, Workday, Microsoft Graph, and the Microsoft data stack so adoption is friction-free.
- **Outcome-anchored.** Every engagement starts with the metric we're moving and ends with proof we moved it.

### Award Nomination System (one-liner)
> Recognize the right people, faster — with an AI-assisted nomination workflow that catches bias, surfaces collusion, and drops approved awards directly into Workday.

### Integrity & Fraud Detection (one-liner)
> Systemic fraud doesn't show up in a single transaction. We combine rule engines, statistical anomaly detection, graph analysis, and ML models to find patterns no human review can.

### AI Analytics (one-liner)
> Forecasts, classifications, anomaly detection, and embedding-based search built on your data — productionized, monitored, and explainable.

### Data Mining (one-liner)
> Pattern discovery on the data you already have. We mine operational, financial, and HR datasets to surface segments, drivers, and risks worth acting on.

### Datacenter → Cloud Migration (one-liner)
> From assessment to cutover to post-migration optimization. Azure-first, Terraform-driven, with a rollback plan written before we move anything.

---

## 7. Rollout Sequencing (suggested phases)

### Phase 1 — Repositioning (1–2 weeks)
1. Update Header navigation (Products / **Services** / About / Contact).
2. Rewrite Home (hero + tile rows + Why Terian + footer columns).
3. Expand About page.
4. Add real Contact form.
5. Migrate routing to `react-router-dom` and add 301 redirects for old URLs.

### Phase 2 — Service & product pages (2–3 weeks)
1. Build Services index.
2. Build AI Analytics, Integrity & Fraud Detection, Data Mining, Cloud Migration detail pages.
3. Rewrite Award Nomination System page with AI/ML section, integrations, security & compliance.
4. Add "Integrity Sentinel — Coming Soon" teaser.

### Phase 3 — Trust & polish (1–2 weeks)
1. Add `/trust` page.
2. SEO (per-page meta, sitemap, robots, JSON-LD).
3. Analytics + lead capture.
4. OG images, favicons, brand consistency pass.
5. Lighthouse CI + Playwright smoke tests.

### Phase 4 — Roadmap signaling (ongoing)
1. Add MLOps service page.
2. Launch `/insights` (blog) with 3 seed posts:
   - "Detecting collusion in employee recognition data"
   - "An Azure-first migration playbook for mid-market teams"
   - "Practical AI analytics: starting with the metric, not the model"
3. Add case studies / anonymized engagement summaries as they accrue.

---

## 8. Definition of Done (per page)

A page is "done" when:
- Copy reviewed by David.
- Per-page `<title>` and meta description set.
- Mobile layout verified at 375px width.
- All CTAs route to a working destination (mailto or form).
- Internal links validated (no 404s).
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.

---

## 9. Open Questions for David

1. Do we want to position the company name as **"Terian Services"** (current) or shift toward something product-led (e.g., a sub-brand for the Award Nomination System)?
2. Are any current/past clients citable as logos or anonymized case studies?
3. What is the right pricing posture — "Contact us" everywhere, or publish indicative ranges for services engagements?
4. Should the site stay single-region (West US 2) public-facing, or do we add an EU/UK landing for GDPR signaling?
5. Timeline target: do we need Phase 1 done by a specific event/date?
