# Requirements v2 — Award Nomination System: Total-Cost / ROI Calculator (terianix.ai)

**Owner:** David Terian / Terian Services Inc.
**Status:** Decisions locked · implemented (v2.1 revisions applied)
**Supersedes:** `ROI_Calculator_Requirements.md` (v1). This version records the decisions made at kickoff (§11 of v1) and the model change that followed.

---

## 1. Purpose

An interactive **Total-Cost / ROI calculator** for the **Award Nomination System**, hosted on **terianix.ai**, that lets a prospective buyer enter a few numbers about their organization and instantly see estimated annual value, net benefit, ROI %, and payback period — and optionally capture their inputs as a sales lead. It replaces the idea of emailing a static Excel worksheet: a web tool stays in sync with live pricing, needs no attachment, and captures leads.

## 2. Product context (grounds the model)

The **Award Nomination System** is a multi-tenant SaaS platform for **monetary employee recognition** with an **AI integrity engine** at its core. It runs the full workflow (nomination → manager approval → payout), screens every award with a multi-model AI engine (rules + Random Forest + Isolation Forest + graph collusion detection + NLP) that blocks or flags fraud, favoritism, and reciprocal "rings" **before payout**, forecasts recognition spend against budget, and **pays out through the customer's existing payroll** (Gusto/Rippling/Workday-style) — not points or gift cards.

**Pricing (source of truth):** the live pricing page and this calculator both read from the same backend endpoint `GET /api/engagement/award-nomination` (CosmosDB `engagement_details`). Tiers carry `price_monthly`, `price_annual` (both are `/mo` figures), and `null` price for Enterprise. **The calculator never hardcodes prices** — if pricing changes in Cosmos, the calculator updates automatically. (Reference: https://www.terianix.ai/pricing/award-nomination)

| Plan | Users | Billed annually | Billed monthly |
|---|---|---|---|
| Starter | up to 50 | $149/mo | $189/mo |
| Professional (most popular) | 50–500 | $499/mo | $624/mo |
| Enterprise | 500+ | Custom | Custom |

## 3. Goals & success criteria

- A prospect gets a **credible ROI estimate in under a minute**, with sensible defaults so a result shows on first load.
- **Conservative and transparent** — assumptions visible and editable; no black-box or hype numbers. This is a trust tool; finance/technical buyers will scrutinize it.
- **Lead capture** — optionally collect email + inputs, routed to the existing contact flow.
- **Always current** with live pricing.
- **Responsive and accessible** (mobile-friendly, WCAG-minded).

## 4. Placement & entry points — **DECIDED: "Both"**

- **Dedicated calculator page** `/pricing/award-nomination/roi_calculator` — the calculator lives here (its own URL, deep-link/query-param prefill supported for sales).
- **Section on the Pricing page** (`/pricing/award-nomination`) — a "Calculate your ROI" section header + **button** linking to the calculator page (the calculator is NOT embedded on the pricing page).
- **Product-page CTA** — a "Calculate your ROI" button on `/products/award-nomination` linking to the calculator (§4 secondary entry point). **DECIDED: include.**
- **Decision Maker soliciting document** — the `/pricing/award-nomination/roi_calculator` link is added to `01_Decision_Maker_Overview.md` (in the David64_Award_Nominations repo) so prospects can jump straight to it.

## 5. The ROI model (implement exactly)

### 5.1 What changed from v1 (important)

The v1 **admin approval-time lever was removed.** Rationale (David, kickoff): in the actual workflow a peer nominates a peer, it routes to the nominee's manager, the manager clicks approve, and it auto-sends to payroll. Whether the manager approves now or three days later does not change cost — there is no material "approval labor" to save. The v1 default (2 hrs/nomination × 75% reduction ≈ $135k) was both unrealistic for this workflow and the sole cause of an implausible ~2,400% headline ROI. Removing it makes **fraud prevention — the actual differentiator — carry the ROI.**

Consequently the **"nominations per year"** and **"current approval time"** inputs from v1 are dropped (they no longer feed any lever).

### 5.2 Inputs (user-entered)

| Input | Type | Default | Range | Notes |
|---|---|---|---|---|
| Number of employees | integer | 300 | 1–100,000 | Auto-suggests a plan. |
| Annual recognition budget ($) | currency | 500,000 | ≥ 0 | Total monetary awards paid per year. |
| Loaded hourly cost of finance/HR ($/hr) | currency | 60 | ≥ 0 | Fully-loaded (salary + overhead). Used by the payroll lever. |
| Plan | select | auto by employees | Starter / Professional / Enterprise | Auto-suggest; user can override. |

> **Billing is fixed to Annual** and not shown in the calculator (the Annual/Monthly toggle was dropped as confusing). The pricing *page* still has its own Annual/Monthly toggle for the cards.
| **Payroll frequency** | select | **Monthly (12)** | Weekly (52) / Biweekly (26) / Semi-monthly (24) / Monthly (12) | Only used by the payroll lever. |
| **Manual hours per pay run** | number | **1.5** | ≥ 0 | Finance time spent manually processing award payouts today, per pay run. |

### 5.3 Value levers

| Lever | Default state | Notes |
|---|---|---|
| **Fraud & abuse prevented** (was "leakage") | **Always on** | The star of the model — this is what the integrity engine does. Renamed in the UI from "leakage" so buyers parse it instantly. |
| **Payroll automation savings** | **On by default** | Flagship capability, not a soft add-on. Concrete and small at defaults (~$1,080/yr), so showing it does not re-inflate the headline. Seed 1.5 hrs/pay run; editable. |
| **Budget-overrun avoidance** | **Off by default** | The genuinely speculative lever (assumes you'd otherwise overspend). The only opt-in lever. |

Copy note: the **payroll-native benefit** ("Pays out through your existing payroll. No IT, no manual processing, live in 4 weeks.") is shown as a value statement regardless of the dollar lever.

### 5.4 Assumptions (editable defaults, shown with tooltips)

| Assumption | Default | Rationale |
|---|---|---|
| % of budget lost to gaming/fraud/favoritism | **4%** (allow 3–5%) | Modest for credibility; user can adjust. |
| Detection effectiveness (share of that leakage prevented) | **70%** | Engine reduces, does not claim to eliminate. |
| Budget-overrun avoided (only if lever enabled) | **3%** of budget | Softer; off by default. |

### 5.5 Formulas

```
fraud_prevented          = annual_budget × leakage_pct × detection_effectiveness
payroll_cost_saved       = payroll_on ? pay_periods_per_year × manual_hours_per_run × loaded_hourly_cost : 0
overrun_avoidance        = overrun_on ? annual_budget × overrun_pct : 0

annual_value             = fraud_prevented + payroll_cost_saved + overrun_avoidance

annual_subscription_cost = selected_plan_price × 12        (price = annual or monthly /mo figure per Billing)
net_annual_benefit       = annual_value − annual_subscription_cost
roi_percent              = net_annual_benefit / annual_subscription_cost × 100
payback_months           = annual_subscription_cost / (annual_value / 12)
```

- **Enterprise** (null price): show value levers, replace cost/ROI/payback with a **"Contact sales for pricing"** CTA — never fabricate a price.
- Guard divide-by-zero: `annual_value = 0` → payback = "n/a", ROI = "n/a".
- Round money to whole dollars; ROI to whole %; payback to 1 decimal.
- **Sanity check of defaults** (Professional, annual, payroll on): fraud $14,000 + payroll $1,080 = **$15,080** value vs $5,988 cost → **ROI ≈ 152%, payback ≈ 4.8 months.** With payroll off: **~134% / 5.1 months.** Credible range, driven by the fraud engine.

### 5.6 Outputs (display)

- **Headline cards:** Estimated annual value · Net annual benefit · ROI % · Payback (months).
- **Breakdown:** fraud prevented, payroll saved (and overrun if enabled) vs. subscription cost.
- **Chart:** annual value vs. annual cost (recharts bar).
- **Assumptions panel:** visible and editable, with tooltips.
- **Disclaimer (required):** "Estimate for illustration only, based on your inputs and stated assumptions; not a guarantee of results."

## 6. UX / interaction

- Live recompute on every change (no calculate button required).
- Ship with defaults that produce a sensible first-load result.
- Plan auto-selects from employee count; user can override.
- Number fields + sliders where helpful; currency formatting; validation.
- **Conservative / Typical** preset toggle that sets the assumption bundle.
- No "Copy shareable link" control (dropped). Deep-link prefill via query params still works for hand-built or sales-sent URLs.
- "Reset to defaults" control.

## 7. Lead capture

- **Do not gate** the estimate behind a form. Show the result, then offer **"Email me these results"** / **"Book a walkthrough."** (DECIDED: open, no gate.)
- **Option A (implemented):** submit posts to a new **`POST /api/roi/email`** endpoint (`backend/routers/roi_router.py`) which (1) **emails the prospect their own results** — the promised action — (2) emails the Terian team a lead notification, and (3) writes a lead doc to Cosmos (`client_communications`, source `roi-calculator`). All three steps best-effort. "Book a walkthrough" links to `/contact`.
- **Analytics — Azure Application Insights** (existing `telemetry.ts`): fire `roi_calculator_viewed`, `roi_calculated`, `roi_lead_submitted`.

## 8. Technical

- **Stack (confirmed from repo):** React 19 + Vite + TypeScript + Tailwind; **recharts** already a dependency; App Insights already wired. Build as a self-contained component.
- **All math client-side.** Backend only for lead capture (new `POST /api/roi/email`, reuses the existing SMTP + Cosmos setup).
- **Pricing as shared config** — same `/api/engagement/award-nomination` endpoint as the pricing page (single source of truth).
- Responsive + accessible (keyboard, labels, contrast).
- **Currency: USD only** for v1.

## 9. Non-goals

- Not a binding quote, contract, or guaranteed-savings claim.
- Not a replacement for a sales conversation on Enterprise pricing.

## 10. Deliverables

1. `src/data/awardRoiModel.ts` — pure model (types, defaults, presets, compute).
2. `src/components/RoiCalculator.tsx` — the calculator component.
3. Dedicated `/pricing/award-nomination/roi_calculator` page (`AwardNominationRoiPage`); pricing page shows a header + button linking to it.
4. "Calculate your ROI" CTA on the product page.
5. Backend `roi_router.py` (`POST /api/roi/email`, prospect + internal email + lead) + App Insights events.
6. `/roi` link added to the Decision Maker Overview doc.

## 11. Decisions resolved (were open in v1 §11)

1. Leakage % **4%**, detection **70%** — confirmed.
2. Budget-overrun avoidance — **off by default** (only opt-in lever).
3. Approval-time lever — **removed entirely** (see §5.1).
4. Payroll automation — **on by default**, frequency dropdown (default Monthly/12), 1.5 hr/run seed.
5. Gate results — **no gate**; open "email/book" CTA. "Email me these results" now truly emails the prospect (Option A).
6. Endpoint — new **`POST /api/roi/email`** (prospect + internal email + lead); analytics — **App Insights**.
7. Stack — **React/Vite/TS/Tailwind/recharts** (matches repo).
8. Currency — **USD only** for v1.
9. Placement — calculator on dedicated **`/roi_calculator`** page; pricing page = header + button; product-page CTA; Decision Maker doc link.
10. Dropped from the calculator: Annual/Monthly billing toggle (Annual only), "Copy shareable link", and all "your organization" wording; "Your estimate" → "Estimate".

---
*Terian Services Inc. · Award Nomination System · ROI Calculator brief v2.*
