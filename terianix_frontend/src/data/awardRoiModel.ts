/**
 * awardRoiModel.ts
 * ────────────────
 * Pure, framework-free ROI model for the Award Nomination System calculator.
 *
 * All math lives here (no React, no DOM) so it can be unit-tested and reused.
 * See ROI_Calculator_Requirements_v2.md §5 for the specification.
 *
 * Value levers:
 *   • Fraud & abuse prevented — always on (the integrity engine's core value).
 *   • Payroll automation savings — on by default (flagship; small + concrete).
 *   • Budget-overrun avoidance — off by default (the only speculative lever).
 *
 * The v1 "admin approval-time" lever was removed: manager approval is a click,
 * not measurable labor, and it was the sole cause of an implausible headline.
 */

// ── Pricing tier shape (mirrors AwardNominationPricingPage's Tier) ────────────

export interface Tier {
  name: string;
  user_range: string;
  price_monthly: number | null;
  price_annual: number | null;
}

export type Billing = "annual" | "monthly";

/** Payroll cadence → pay periods per year. */
export const PAY_FREQUENCIES = [
  { id: "weekly", label: "Weekly", periods: 52 },
  { id: "biweekly", label: "Biweekly", periods: 26 },
  { id: "semimonthly", label: "Semi-monthly", periods: 24 },
  { id: "monthly", label: "Monthly", periods: 12 },
] as const;

export type PayFrequencyId = (typeof PAY_FREQUENCIES)[number]["id"];

export function payPeriodsPerYear(id: PayFrequencyId): number {
  return PAY_FREQUENCIES.find((f) => f.id === id)?.periods ?? 12;
}

// ── Inputs & assumptions ──────────────────────────────────────────────────────

export interface RoiInputs {
  employees: number;
  annualBudget: number;
  loadedHourlyCost: number;
  /** null = auto-suggest from employee count. */
  planName: string | null;
  billing: Billing;

  // Payroll lever
  payrollEnabled: boolean;
  payFrequency: PayFrequencyId;
  manualHoursPerRun: number;

  // Budget-overrun lever (opt-in)
  overrunEnabled: boolean;
}

export interface RoiAssumptions {
  /** Share of budget lost to gaming/fraud/favoritism (0–1). */
  leakagePct: number;
  /** Share of that leakage the engine prevents (0–1). */
  detectionEffectiveness: number;
  /** Share of budget saved via overrun avoidance, if enabled (0–1). */
  overrunPct: number;
}

export const DEFAULT_INPUTS: RoiInputs = {
  employees: 300,
  annualBudget: 500_000,
  loadedHourlyCost: 60,
  planName: null, // auto
  billing: "annual",
  payrollEnabled: true,
  payFrequency: "monthly",
  manualHoursPerRun: 1.5,
  overrunEnabled: false,
};

export const DEFAULT_ASSUMPTIONS: RoiAssumptions = {
  leakagePct: 0.04,
  detectionEffectiveness: 0.7,
  overrunPct: 0.03,
};

/** Preset assumption bundles for the Conservative / Typical toggle. */
export const PRESETS: Record<
  "conservative" | "typical",
  { assumptions: RoiAssumptions; manualHoursPerRun: number }
> = {
  conservative: {
    assumptions: { leakagePct: 0.03, detectionEffectiveness: 0.6, overrunPct: 0.02 },
    manualHoursPerRun: 1.0,
  },
  typical: {
    assumptions: { leakagePct: 0.04, detectionEffectiveness: 0.7, overrunPct: 0.03 },
    manualHoursPerRun: 1.5,
  },
};

// ── Plan selection ────────────────────────────────────────────────────────────

/**
 * Parse the upper bound of employees a tier covers from its user_range string
 * (e.g. "up to 50", "50–500", "500+"). Returns Infinity for open-ended tiers
 * and NaN when nothing parseable is found.
 */
function tierUpperBound(userRange: string): number {
  if (/\+/.test(userRange)) return Infinity;
  const nums = userRange.match(/[\d,]+/g)?.map((n) => Number(n.replace(/,/g, "")));
  if (!nums || nums.length === 0) return NaN;
  return Math.max(...nums);
}

/**
 * Auto-suggest a tier from employee count. Tiers are expected in ascending
 * order (Starter → Professional → Enterprise); falls back to that order if a
 * user_range can't be parsed.
 */
export function suggestTier(tiers: Tier[], employees: number): Tier | null {
  if (!tiers.length) return null;
  for (const tier of tiers) {
    const bound = tierUpperBound(tier.user_range);
    if (!Number.isNaN(bound) && employees <= bound) return tier;
  }
  return tiers[tiers.length - 1]; // largest tier (e.g. Enterprise)
}

/** Resolve the active tier from an explicit plan name, else auto-suggest. */
export function resolveTier(
  tiers: Tier[],
  planName: string | null,
  employees: number,
): Tier | null {
  if (planName) {
    const match = tiers.find((t) => t.name === planName);
    if (match) return match;
  }
  return suggestTier(tiers, employees);
}

/** Per-month price for the selected billing period; null for custom (Enterprise). */
export function tierMonthlyPrice(tier: Tier | null, billing: Billing): number | null {
  if (!tier) return null;
  return billing === "annual" ? tier.price_annual : tier.price_monthly;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface RoiResult {
  fraudPrevented: number;
  payrollCostSaved: number;
  overrunAvoidance: number;
  annualValue: number;

  tier: Tier | null;
  /** null when the tier has custom pricing (Enterprise). */
  annualSubscriptionCost: number | null;
  isCustomPricing: boolean;

  /** null when custom pricing or annualValue is 0 (guarded). */
  netAnnualBenefit: number | null;
  roiPercent: number | null;
  paybackMonths: number | null;
}

// ── Compute ───────────────────────────────────────────────────────────────────

export function computeRoi(
  inputs: RoiInputs,
  assumptions: RoiAssumptions,
  tiers: Tier[],
): RoiResult {
  const budget = Math.max(0, inputs.annualBudget || 0);

  const fraudPrevented =
    budget * clamp01(assumptions.leakagePct) * clamp01(assumptions.detectionEffectiveness);

  const payrollCostSaved = inputs.payrollEnabled
    ? payPeriodsPerYear(inputs.payFrequency) *
      Math.max(0, inputs.manualHoursPerRun || 0) *
      Math.max(0, inputs.loadedHourlyCost || 0)
    : 0;

  const overrunAvoidance = inputs.overrunEnabled
    ? budget * clamp01(assumptions.overrunPct)
    : 0;

  const annualValue = fraudPrevented + payrollCostSaved + overrunAvoidance;

  const tier = resolveTier(tiers, inputs.planName, inputs.employees);
  const monthly = tierMonthlyPrice(tier, inputs.billing);
  const isCustomPricing = tier != null && monthly == null;
  const annualSubscriptionCost = monthly == null ? null : monthly * 12;

  let netAnnualBenefit: number | null = null;
  let roiPercent: number | null = null;
  let paybackMonths: number | null = null;

  if (annualSubscriptionCost != null && annualSubscriptionCost > 0) {
    netAnnualBenefit = annualValue - annualSubscriptionCost;
    roiPercent = (netAnnualBenefit / annualSubscriptionCost) * 100;
    // Guard divide-by-zero: no value → payback undefined.
    paybackMonths = annualValue > 0 ? annualSubscriptionCost / (annualValue / 12) : null;
  }

  return {
    fraudPrevented,
    payrollCostSaved,
    overrunAvoidance,
    annualValue,
    tier,
    annualSubscriptionCost,
    isCustomPricing,
    netAnnualBenefit,
    roiPercent,
    paybackMonths,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
