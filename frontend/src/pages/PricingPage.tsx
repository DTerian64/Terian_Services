import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

// ── Types matching the CosmosDB document schema ───────────────────────────────

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

// ── Feature cell renderer ─────────────────────────────────────────────────────

function FeatureCell({ value }: { value: string | boolean | null }) {
  if (value === true) {
    return (
      <span className="flex justify-center">
        <CheckIcon />
      </span>
    );
  }
  if (value === false || value === null) {
    return (
      <span className="flex justify-center text-white/20" aria-label="Not included">
        —
      </span>
    );
  }
  // String value (e.g. "Manual", "99.9%", "Bulk CSV upload")
  return (
    <span className="block text-center text-sm text-white/70">{value}</span>
  );
}

function CheckIcon() {
  return (
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
  );
}

// ── Tier card (top section) ───────────────────────────────────────────────────

function TierCard({ tier }: { tier: Tier }) {
  const isEnterprise = tier.price_annual === null;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        tier.highlight
          ? "border-teal-500/60 bg-teal-950/40 shadow-lg shadow-teal-900/30"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-[#0f0d18]">
          Most popular
        </span>
      )}

      <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
        {tier.name}
      </p>
      <p className="mt-1 text-sm text-white/50">{tier.user_range}</p>

      <div className="mt-6">
        {isEnterprise ? (
          <p className="font-playfair text-3xl font-bold text-slate-100">
            Custom
          </p>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="font-playfair text-4xl font-bold text-slate-100">
                ${tier.price_annual}
              </span>
              <span className="mb-1 text-sm text-white/40">/mo</span>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Billed annually · ${tier.price_monthly}/mo billed monthly
            </p>
          </>
        )}
      </div>

      <a
        href={tier.cta_href}
        className={`mt-8 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
          tier.highlight
            ? "bg-teal-500 text-[#0f0d18] hover:bg-teal-400"
            : "border border-white/20 text-white hover:bg-white/10"
        }`}
      >
        {tier.cta_label}
      </a>
    </div>
  );
}

// ── Feature comparison table ──────────────────────────────────────────────────

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
            <th className="pb-4 text-left text-xs font-semibold uppercase tracking-widest text-white/40">
              Features
            </th>
            {tiers.map((t) => (
              <th
                key={t.name}
                className={`pb-4 text-center text-xs font-semibold uppercase tracking-widest ${
                  t.highlight ? "text-teal-400" : "text-white/40"
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
              {/* Group header row */}
              <tr key={`group-${group.name}`}>
                <td
                  colSpan={tierNames.length + 1}
                  className="border-t border-white/10 pb-2 pt-6 text-xs font-semibold uppercase tracking-widest text-teal-400"
                >
                  {group.name}
                </td>
              </tr>

              {/* Feature rows */}
              {group.features.map((feature) => (
                <tr
                  key={feature.name}
                  className="border-t border-white/[0.06] hover:bg-white/[0.02]"
                >
                  <td className="py-3 pr-6 text-white/70">{feature.name}</td>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [doc, setDoc] = useState<EngagementDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    const apiBase =
      (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

    fetch(`${apiBase}/api/engagement/award-nomination`)
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

      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10">

        {/* Loading / error states */}
        {loading && (
          <p className="text-center text-white/40">Loading pricing…</p>
        )}
        {error && (
          <p className="text-center text-red-400">
            Could not load pricing data. Please try again later.
          </p>
        )}

        {doc && (
          <>
            {/* Product label + tagline */}
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
                {doc.service}
              </p>
              <p className="mt-2 text-white/60">{doc.tagline}</p>
            </div>

            {/* Annual / Monthly toggle */}
            <div className="mb-10 flex items-center justify-center gap-3">
              <span className={`text-sm ${!annual ? "text-white" : "text-white/40"}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setAnnual((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  annual ? "bg-teal-500" : "bg-white/20"
                }`}
                aria-label="Toggle billing period"
              >
                <span
                  className={`inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform ${
                    annual ? "translate-x-6" : ""
                  }`}
                />
              </button>
              <span className={`text-sm ${annual ? "text-white" : "text-white/40"}`}>
                Annual
                <span className="ml-1.5 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                  Save ~20%
                </span>
              </span>
            </div>

            {/* Tier cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {doc.tiers.map((tier) => (
                <TierCard
                  key={tier.name}
                  tier={
                    annual
                      ? tier
                      : { ...tier, price_annual: tier.price_monthly }
                  }
                />
              ))}
            </div>

            {/* Feature comparison table */}
            <FeatureTable
              tiers={doc.tiers}
              feature_groups={doc.feature_groups}
            />

            {/* Services note */}
            {doc.services_note && (
              <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
                  Professional Services
                </p>
                <p className="mt-2 text-white/60">{doc.services_note}</p>
                <a
                  href="/contact"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-400 transition hover:text-teal-300"
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
