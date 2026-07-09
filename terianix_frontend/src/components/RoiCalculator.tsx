/**
 * RoiCalculator.tsx
 * ─────────────────
 * Interactive Total-Cost / ROI calculator for the Award Nomination System.
 *
 * • Pricing is read live from GET /api/engagement/award-nomination — the SAME
 *   endpoint the pricing page uses, so prices never drift.
 * • All math is client-side (see data/awardRoiModel.ts).
 * • Lead capture posts to POST /api/roi/email (emails the prospect + notifies sales).
 * • Analytics via Azure Application Insights (telemetry.ts).
 *
 * See ROI_Calculator_Requirements_v2.md for the specification.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { appInsights } from "../telemetry";
import {
  computeRoi,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_INPUTS,
  formatUsd,
  PAY_FREQUENCIES,
  PRESETS,
  resolveTier,
  type PayFrequencyId,
  type RoiAssumptions,
  type RoiInputs,
  type Tier,
} from "../data/awardRoiModel";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface EngagementDoc {
  service: string;
  tagline: string;
  tiers: Tier[];
}

// ── URL -> state (deep-link prefill) ─────────────────────────────────────────

function readInputsFromUrl(base: RoiInputs): RoiInputs {
  if (typeof window === "undefined") return base;
  const q = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => {
    const v = q.get(k);
    if (v == null) return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const bool = (k: string, d: boolean) => {
    const v = q.get(k);
    return v == null ? d : v === "1" || v === "true";
  };
  const freq = (q.get("freq") as PayFrequencyId | null) ?? base.payFrequency;
  return {
    ...base,
    employees: num("emp", base.employees),
    annualBudget: num("budget", base.annualBudget),
    loadedHourlyCost: num("rate", base.loadedHourlyCost),
    planName: q.get("plan") ?? base.planName,
    payrollEnabled: bool("payroll", base.payrollEnabled),
    payFrequency: PAY_FREQUENCIES.some((f) => f.id === freq) ? freq : base.payFrequency,
    manualHoursPerRun: num("hrs", base.manualHoursPerRun),
    overrunEnabled: bool("overrun", base.overrunEnabled),
  };
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function InfoDot({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/30 text-[10px] font-bold text-slate-400"
      >
        ?
      </span>
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg border border-violet-400/30 bg-slate-800 px-3 py-2 text-xs font-normal leading-5 text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">
        {label}
        {hint ? <InfoDot text={hint} /> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-white/20 bg-[#0f0d18] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400";

function HeadlineCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "border-violet-400/50 bg-[#0f1a19]" : "border-white/10 bg-[#0f0d18]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 font-playfair text-3xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoiCalculator() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState(false);

  const [inputs, setInputs] = useState<RoiInputs>(() => readInputsFromUrl(DEFAULT_INPUTS));
  const [assumptions, setAssumptions] = useState<RoiAssumptions>(DEFAULT_ASSUMPTIONS);
  const [preset, setPreset] = useState<"conservative" | "typical" | "custom">("typical");

  const viewedFired = useRef(false);

  // Fetch live pricing (shared source of truth with the pricing page).
  useEffect(() => {
    fetch(`${API_BASE}/api/engagement/award-nomination`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EngagementDoc>;
      })
      .then((doc) => setTiers(doc.tiers ?? []))
      .catch(() => setPriceError(true))
      .finally(() => setLoadingPrice(false));
  }, []);

  // Analytics: calculator viewed (once).
  useEffect(() => {
    if (!viewedFired.current) {
      viewedFired.current = true;
      appInsights?.trackEvent({ name: "roi_calculator_viewed" });
    }
  }, []);

  const result = useMemo(
    () => computeRoi(inputs, assumptions, tiers),
    [inputs, assumptions, tiers],
  );

  // Analytics: recompute (debounced) once we have pricing.
  useEffect(() => {
    if (loadingPrice) return;
    const t = setTimeout(() => {
      appInsights?.trackEvent({
        name: "roi_calculated",
        properties: {
          employees: inputs.employees,
          plan: result.tier?.name ?? "n/a",
          annualValue: Math.round(result.annualValue),
          roiPercent: result.roiPercent == null ? null : Math.round(result.roiPercent),
        },
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [inputs, assumptions, result, loadingPrice]);

  const set = <K extends keyof RoiInputs>(key: K, value: RoiInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (p: "conservative" | "typical") => {
    setPreset(p);
    setAssumptions(PRESETS[p].assumptions);
    setInputs((prev) => ({ ...prev, manualHoursPerRun: PRESETS[p].manualHoursPerRun }));
  };

  const setAssumption = (key: keyof RoiAssumptions, value: number) => {
    setPreset("custom");
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setPreset("typical");
  };

  const activeTierName =
    resolveTier(tiers, inputs.planName, inputs.employees)?.name ?? "";

  const chartData = [
    { name: "Annual value", value: Math.round(result.annualValue), fill: "#a78bfa" },
    {
      name: "Annual cost",
      value: Math.round(result.annualSubscriptionCost ?? 0),
      fill: "#475569",
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0916] p-6 lg:p-8">
      {/* Preset toggle + reset */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/15 p-1">
          {(["conservative", "typical"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                preset === p
                  ? "bg-violet-500 text-[#0f0d18]"
                  : "text-slate-300 hover:text-violet-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-violet-300 hover:text-violet-300"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* ── Inputs ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <Field label="Number of employees" hint="Used to suggest a plan.">
            <input
              type="number"
              min={1}
              max={100000}
              value={inputs.employees}
              onChange={(e) => set("employees", Math.round(Number(e.target.value)))}
              className={inputClass}
            />
          </Field>

          <Field
            label="Annual recognition budget ($)"
            hint="Total monetary awards paid per year."
          >
            <input
              type="number"
              min={0}
              step={1000}
              value={inputs.annualBudget}
              onChange={(e) => set("annualBudget", Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          {/* Plan */}
          <Field label="Plan" hint="Auto-suggested from employees; override if needed.">
            <select
              value={inputs.planName ?? activeTierName}
              onChange={(e) => set("planName", e.target.value)}
              className={inputClass}
            >
              {tiers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Payroll lever */}
          <div className="rounded-xl border border-white/10 bg-[#0f0d18] p-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">
                Payroll automation savings
                <InfoDot text="Pays out through your existing payroll — no IT, no manual processing, live in 4 weeks. Estimates finance time saved not manually processing award payouts." />
              </span>
              <input
                type="checkbox"
                checked={inputs.payrollEnabled}
                onChange={(e) => set("payrollEnabled", e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
            </label>
            {inputs.payrollEnabled && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Field label="Payroll frequency">
                  <select
                    value={inputs.payFrequency}
                    onChange={(e) => set("payFrequency", e.target.value as PayFrequencyId)}
                    className={inputClass}
                  >
                    {PAY_FREQUENCIES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Manual hrs / pay run"
                  hint="Finance time spent manually processing award payouts today, per pay run."
                >
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={inputs.manualHoursPerRun}
                    onChange={(e) => set("manualHoursPerRun", Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Loaded hourly cost ($/hr)"
                  hint="Fully-loaded finance/HR cost (salary + overhead)."
                >
                  <input
                    type="number"
                    min={0}
                    value={inputs.loadedHourlyCost}
                    onChange={(e) => set("loadedHourlyCost", Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Assumptions */}
          <h3 className="pt-2 text-sm font-bold uppercase tracking-[0.18em] text-violet-400">
            Assumptions
          </h3>

          <Field
            label={`Budget lost to fraud / favoritism: ${(assumptions.leakagePct * 100).toFixed(0)}%`}
            hint="Modest by default (3–5%) for credibility. Adjust to your reality."
          >
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={assumptions.leakagePct * 100}
              onChange={(e) => setAssumption("leakagePct", Number(e.target.value) / 100)}
              className="w-full accent-violet-500"
            />
          </Field>

          <Field
            label={`Detection effectiveness: ${(assumptions.detectionEffectiveness * 100).toFixed(0)}%`}
            hint="Share of that leakage the integrity engine prevents. It reduces, but won't claim to eliminate."
          >
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={assumptions.detectionEffectiveness * 100}
              onChange={(e) =>
                setAssumption("detectionEffectiveness", Number(e.target.value) / 100)
              }
              className="w-full accent-violet-500"
            />
          </Field>

          <div className="rounded-xl border border-white/10 bg-[#0f0d18] p-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">
                Include budget-overrun avoidance
                <InfoDot text="Optional and off by default (the softest lever). Assumes forecasting keeps you from overspending your recognition budget." />
              </span>
              <input
                type="checkbox"
                checked={inputs.overrunEnabled}
                onChange={(e) => set("overrunEnabled", e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
            </label>
            {inputs.overrunEnabled && (
              <div className="mt-4">
                <Field
                  label={`Overrun avoided: ${(assumptions.overrunPct * 100).toFixed(0)}% of budget`}
                >
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={assumptions.overrunPct * 100}
                    onChange={(e) => setAssumption("overrunPct", Number(e.target.value) / 100)}
                    className="w-full accent-violet-500"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ── Results ────────────────────────────────────────── */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-violet-400">
            Estimate
          </h3>

          {priceError && (
            <p className="text-sm text-red-400">
              Could not load live pricing. Value estimate still shows below.
            </p>
          )}

          {result.isCustomPricing ? (
            <div className="rounded-2xl border border-violet-400/50 bg-[#0f1a19] p-6">
              <p className="text-sm text-slate-300">
                Estimated annual value
              </p>
              <p className="mt-1 font-playfair text-4xl font-bold text-slate-100">
                {formatUsd(result.annualValue)}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Enterprise pricing is tailored to your needs, so we don't show a
                fabricated ROI here. Talk to us for a precise number.
              </p>
              <a
                href="/contact"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#0f0d18] transition hover:bg-violet-400"
              >
                Contact sales for pricing →
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <HeadlineCard
                  label="Est. annual value"
                  value={formatUsd(result.annualValue)}
                  accent
                />
                <HeadlineCard
                  label="Net annual benefit"
                  value={
                    result.netAnnualBenefit == null
                      ? "—"
                      : formatUsd(result.netAnnualBenefit)
                  }
                  accent
                />
                <HeadlineCard
                  label="ROI"
                  value={result.roiPercent == null ? "n/a" : `${Math.round(result.roiPercent)}%`}
                />
                <HeadlineCard
                  label="Payback"
                  value={
                    result.paybackMonths == null
                      ? "n/a"
                      : `${result.paybackMonths.toFixed(1)} mo`
                  }
                />
              </div>

              {/* Chart */}
              <div className="rounded-2xl border border-white/10 bg-[#0f0d18] p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: unknown) => formatUsd(Number(v ?? 0))}
                        fill="#e2e8f0"
                        fontSize={12}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-[#0f0d18] p-5 text-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              How the value breaks down
            </p>
            <BreakdownRow label="Fraud & abuse prevented" value={result.fraudPrevented} />
            {inputs.payrollEnabled && (
              <BreakdownRow label="Payroll automation saved" value={result.payrollCostSaved} />
            )}
            {inputs.overrunEnabled && (
              <BreakdownRow label="Budget-overrun avoided" value={result.overrunAvoidance} />
            )}
            <div className="my-2 border-t border-white/10" />
            <BreakdownRow label="Total annual value" value={result.annualValue} bold />
            {!result.isCustomPricing && result.annualSubscriptionCost != null && (
              <BreakdownRow
                label={`Subscription (${activeTierName})`}
                value={-result.annualSubscriptionCost}
              />
            )}
          </div>

          <LeadCapture inputs={inputs} result={result} tierName={activeTierName} />

          <p className="text-xs leading-5 text-slate-500">
            Estimate for illustration only, based on your inputs and stated assumptions; not a
            guarantee of results.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Breakdown row ─────────────────────────────────────────────────────────────

function BreakdownRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={bold ? "font-semibold text-slate-100" : "text-slate-300"}>{label}</span>
      <span
        className={`tabular-nums ${
          value < 0 ? "text-slate-400" : bold ? "font-semibold text-slate-100" : "text-slate-200"
        }`}
      >
        {value < 0 ? `− ${formatUsd(Math.abs(value))}` : formatUsd(value)}
      </span>
    </div>
  );
}

// ── Lead capture (POST /api/roi/email) ────────────────────────────────────────

function LeadCapture({
  inputs,
  result,
  tierName,
}: {
  inputs: RoiInputs;
  result: ReturnType<typeof computeRoi>;
  tierName: string;
}) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/roi/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          company,
          employees: inputs.employees,
          annual_budget: inputs.annualBudget,
          plan: tierName,
          payroll_enabled: inputs.payrollEnabled,
          overrun_enabled: inputs.overrunEnabled,
          annual_value: Math.round(result.annualValue),
          fraud_prevented: Math.round(result.fraudPrevented),
          payroll_saved: Math.round(result.payrollCostSaved),
          overrun_avoided: Math.round(result.overrunAvoidance),
          annual_cost:
            result.annualSubscriptionCost == null
              ? null
              : Math.round(result.annualSubscriptionCost),
          net_benefit:
            result.netAnnualBenefit == null ? null : Math.round(result.netAnnualBenefit),
          roi_percent: result.roiPercent == null ? null : Math.round(result.roiPercent),
          payback_months:
            result.paybackMonths == null ? null : Number(result.paybackMonths.toFixed(1)),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
      appInsights?.trackEvent({
        name: "roi_lead_submitted",
        properties: { plan: tierName, annualValue: Math.round(result.annualValue) },
      });
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-violet-400/50 bg-[#0f1a19] p-5 text-sm text-slate-200">
        Sent — we've emailed these results to {email}, and our team will follow up shortly.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-[#0f0d18] p-5"
    >
      <p className="text-sm font-semibold text-slate-100">Email me these results</p>
      <p className="mt-1 text-xs text-slate-400">
        No gate — your estimate is above. We'll email you a copy and follow up.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="email"
          required
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Company (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
        />
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-400">Something went wrong — please try again.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#0f0d18] transition hover:bg-violet-400 disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Email me these results"}
        </button>
        <a
          href="/contact"
          className="inline-flex items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:border-violet-300 hover:text-violet-300"
        >
          Book a walkthrough
        </a>
      </div>
    </form>
  );
}
