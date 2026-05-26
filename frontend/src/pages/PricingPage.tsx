import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tier {
  name: string;
  user_range: string;
  price_monthly: number | null;
  price_annual: number | null;
  highlight: boolean;
  cta_label: string;
  cta_href: string;
}

interface Feature {
  name: string;
  [tier: string]: string | boolean | null;
}

interface FeatureGroup {
  name: string;
  features: Feature[];
}

interface EngagementDoc {
  service: string;
  tagline: string;
  tiers: Tier[];
  feature_groups: FeatureGroup[];
  services_note: string;
}

// ── Feature cell ──────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: string | boolean | null }) {
  if (value === true) {
    return (
      <span className="flex justify-center">
        <svg
          aria-label="Included"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-teal-400"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (value === false || value === null) {
    return (
      <span className="flex justify-center text-slate-600" aria-label="Not included">
        —
      </span>
    );
  }
  return (
    <span className="block text-center text-sm leading-6 text-slate-300">{value}</span>
  );
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({ tier, showAnnual }: { tier: Tier; showAnnual: boolean }) {
  const isEnterprise = tier.price_annual === null;
  const displayPrice = showAnnual ? tier.price_annual : tier.price_monthly;

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 p-6 transition ${
        tier.highlight
          ? "border-teal-400 bg-[#0f0d18]"
          : "border-white/10 bg-[#0f0d18] hover:border-teal-400"
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-3.5 left-6 rounded-full bg-teal-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#0f0d18]">
          Most popular
        </span>
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
        {tier.name}
      </p>
      <p className="mt-1 text-sm text-slate-400">{tier.user_range}</p>

      <div className="mt-6">
        {isEnterprise ? (
          <p className="font-playfair text-3xl font-bold text-slate-100">Custom</p>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-4xl font-bold text-slate-100">
                ${displayPrice}
              </span>
              <span className="mb-1.5 text-sm text-slate-400">/mo</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {showAnnual
                ? `Billed annually · $${tier.price_monthly}/mo billed monthly`
                : "Billed monthly"}
            </p>
          </>
        )}
      </div>

      <a
        href={tier.cta_href}
        className={`mt-8 inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition ${
          tier.highlight
            ? "bg-teal-400 text-[#0f0d18] hover:bg-teal-300"
            : "border border-white/20 text-slate-100 hover:bg-white/10"
        }`}
      >
        {tier.cta_label}
      </a>
    </div>
  );
}

// ── Feature table ─────────────────────────────────────────────────────────────

function FeatureTable({
  tiers,
  feature_groups,
}: {
  tiers: Tier[];
  feature_groups: FeatureGroup[];
}) {
  const tierNames = tiers.map((t) => t.name);

  return (
    <div className="mt-16 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="pb-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Features
            </th>
            {tiers.map((t) => (
              <th
                key={t.name}
                className={`pb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] ${
                  t.highlight ? "text-teal-400" : "text-slate-500"
                }`}
              >
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {feature_groups.map((group) => (
            <>
              <tr key={`group-${group.name}`}>
                <td
                  colSpan={tierNames.length + 1}
                  className="border-t border-white/10 pb-2 pt-8 text-xs font-semibold uppercase tracking-[0.18em] text-teal-400"
                >
                  {group.name}
                </td>
              </tr>
              {group.features.map((feature) => (
                <tr
                  key={feature.name}
                  className="border-t border-white/[0.06] hover:bg-white/[0.02]"
                >
                  <td className="py-3 pr-6 text-sm text-slate-300">{feature.name}</td>
                  {tierNames.map((tierName) => (
                    <td key={tierName} className="py-3 text-center">
                      <FeatureCell value={feature[tierName] ?? false} />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
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
        eyebrow="Pricing"
        title="Simple, transparent pricing."
        description="One product, three tiers. Scale as your organization grows — no hidden fees, no surprise overages."
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
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
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
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
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {doc.tiers.map((tier) => (
                <TierCard key={tier.name} tier={tier} showAnnual={annual} />
              ))}
            </div>

            {/* Feature comparison table */}
            <FeatureTable tiers={doc.tiers} feature_groups={doc.feature_groups} />

            {/* Professional services note */}
            {doc.services_note && (
              <div className="mt-20">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
                  Professional Services
                </p>
                <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
                  Need a custom engagement?
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  {doc.services_note}
                </p>
                <a
                  href="/contact"
                  className="mt-6 inline-flex items-center justify-center rounded-md border border-white/20 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-white/10"
                >
                  Start a conversation →
                </a>
              </div>
            )}
          </>
        )}
      </section>
    </PageLayout>
  );
}
