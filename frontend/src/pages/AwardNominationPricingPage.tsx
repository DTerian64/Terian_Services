import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tier {
  name: string;
  user_range: string;
  description: string;
  features: string[];
  price_monthly: number | null;
  price_annual: number | null;
  highlight: boolean;
  cta_label: string;
  cta_href: string;
}

interface EngagementDoc {
  service: string;
  tagline: string;
  tiers: Tier[];
}

// ── Check icon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 shrink-0 text-teal-400"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({ tier, showAnnual }: { tier: Tier; showAnnual: boolean }) {
  const isEnterprise = tier.price_annual === null;
  const displayPrice = showAnnual ? tier.price_annual : tier.price_monthly;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-8 transition-all duration-200 ${
        tier.highlight
          ? "border-2 border-teal-400 bg-[#0f1a19]"
          : "border border-white/10 bg-[#0f0d18] hover:border-white/25"
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-3.5 left-8 rounded-full bg-teal-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#0f0d18]">
          Most popular
        </span>
      )}

      {/* Tier name + range */}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">
        {tier.name}
      </p>
      <p className="mt-1 text-sm text-slate-500">{tier.user_range}</p>

      {/* Description */}
      <p className="mt-4 text-sm leading-6 text-slate-300">{tier.description}</p>

      {/* Price — fixed min-height keeps the CTA button vertically aligned across all cards */}
      <div className="mt-8 min-h-[88px] border-t border-white/10 pt-8">
        {isEnterprise ? (
          <>
            <p className="font-playfair text-4xl font-bold text-slate-100">Custom</p>
            <p className="mt-1.5 text-xs text-slate-600">Pricing tailored to your organization</p>
          </>
        ) : (
          <>
            <div className="flex items-end gap-1.5">
              <span className="font-playfair text-5xl font-bold tracking-tight text-slate-100">
                ${displayPrice}
              </span>
              <span className="mb-2 text-sm text-slate-500">/mo</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              {showAnnual
                ? `Billed annually · $${tier.price_monthly}/mo billed monthly`
                : "Billed monthly · save ~20% with annual billing"}
            </p>
          </>
        )}
      </div>

      {/* CTA */}
      <a
        href={tier.cta_href}
        className={`mt-8 flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-bold uppercase tracking-wider transition ${
          tier.highlight
            ? "bg-teal-400 text-[#0f0d18] hover:bg-teal-300"
            : "border border-white/20 text-slate-100 hover:bg-white/10"
        }`}
      >
        {tier.cta_label}
      </a>

      {/* Feature list */}
      <ul className="mt-8 space-y-3">
        {(tier.features ?? []).map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AwardNominationPricingPage() {
  const [doc, setDoc] = useState<EngagementDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/engagement/award-nomination`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EngagementDoc>;
      })
      .then(setDoc)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      <PageHero
        eyebrow="Pricing · Award Nomination"
        title="Simple, transparent pricing."
        description="Three tiers sized for any organization. Scale up as you grow — no hidden fees, no surprise overages."
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">

        {loading && (
          <p className="text-sm text-slate-400">Loading pricing…</p>
        )}
        {error && (
          <p className="text-sm text-red-400">
            Could not load pricing data. Please try again later.
          </p>
        )}

        {doc && (
          <>
            {/* Product label + tagline */}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">
              {doc.service}
            </p>
            <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              {doc.tagline}
            </h2>

            {/* Annual / Monthly toggle */}
            <div className="mt-8 flex items-center gap-3">
              <span className={`text-sm ${!annual ? "text-slate-100" : "text-slate-500"}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setAnnual((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${
                  annual ? "bg-teal-500" : "bg-white/20"
                }`}
                aria-label="Toggle billing period"
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    annual ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm ${annual ? "text-slate-100" : "text-slate-500"}`}>
                Annual
                <span className="ml-2 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                  Save ~20%
                </span>
              </span>
            </div>

            {/* Tier cards */}
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {doc.tiers.map((tier) => (
                <TierCard key={tier.name} tier={tier} showAnnual={annual} />
              ))}
            </div>
          </>
        )}
      </section>
    </PageLayout>
  );
}
