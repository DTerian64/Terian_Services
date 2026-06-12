import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementTier {
  name: string;
  range: string;
  duration: string;
  description: string;
  examples: string[];
  highlight: boolean;
}

interface PaymentStep {
  title: string;
  detail: string;
}

interface DiscoverySprint {
  title: string;
  description: string;
}

interface ContractServicesDoc {
  service: string;
  tagline: string;
  tiers: EngagementTier[];
  payment_steps: PaymentStep[];
  discovery_sprint: DiscoverySprint;
  services_note: string;
}

const STEPS = [
  {
    step: "01",
    title: "Discovery call",
    description:
      "30 minutes, no slides. We talk through the problem, your data and systems, and what \"done\" looks like. We'll tell you honestly whether we're the right fit.",
  },
  {
    step: "02",
    title: "Scope & proposal",
    description:
      "We translate the discovery conversation into a defined outcome, deliverables, timeline, and fixed price — not a time-and-materials open tab.",
  },
  {
    step: "03",
    title: "Engagement letter & kickoff",
    description:
      "Sign the engagement letter, and we're in. Senior engineers embed directly with your team — same people from kickoff to handoff, no offshore relay.",
  },
  {
    step: "04",
    title: "Build, in the open",
    description:
      "Regular check-ins, working software early, and access to everything we build as we build it. No black box, no surprise at the end.",
  },
  {
    step: "05",
    title: "Hand off clean",
    description:
      "Documentation, runbooks, and a knowledge-transfer session. Your team can operate and extend what we built — no lock-in, no dependency on us to keep the lights on.",
  },
];

const TERMS = [
  {
    title: "Fixed-outcome scoping",
    description:
      "Every contract is scoped against a defined deliverable, not an hourly rate. You know what you're getting and what it costs before work starts.",
  },
  {
    title: "No open-ended retainers",
    description:
      "We're not staff augmentation. When the scoped outcome is delivered and handed off, the engagement ends — renew it only if there's a new outcome to scope.",
  },
  {
    title: "Senior engineers only",
    description:
      "The engineers who scope the work are the engineers who build it. No junior shadow teams, no offshore handoff partway through.",
  },
  {
    title: "Azure-native delivery",
    description:
      "Built on Azure AD, Microsoft Graph, ADF, Container Apps, CosmosDB, and Azure SQL — deployed inside your private network, under your governance.",
  },
];

export default function ContractServicesPage() {
  const [doc, setDoc] = useState<ContractServicesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/engagement/contract-services`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ContractServicesDoc>;
      })
      .then(setDoc)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      <PageHero
        eyebrow="Pricing · Contract Services"
        title="How a contract engagement with Terian Services works."
        description="Every engagement starts with a defined outcome — we scope it, build it, and hand off clean. No open-ended retainers, no lock-in. Here's what it takes to get started."
        primaryCta={{ label: "Start an engagement", href: "/engagement/new" }}
        secondaryCta={{ label: "Talk to engineering", href: "/contact" }}
      />

      {/* Process */}
      <section className="border-b border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Process</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            From first call to clean handoff.
          </h2>

          <div className="mt-12 grid gap-6 lg:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.step} className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400">
                <p className="font-playfair text-3xl font-bold text-teal-400">{s.step}</p>
                <h3 className="mt-3 text-base font-bold text-slate-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment / pricing */}
      <section className="border-b border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Investment</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            What an engagement costs — in plain terms.
          </h2>

          {loading && (
            <p className="mt-4 text-sm text-slate-400">Loading engagement details…</p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-400">
              Could not load engagement details. Please try again later.
            </p>
          )}

          {doc && (
            <>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{doc.services_note}</p>

              <div className="mt-12 grid gap-6 lg:grid-cols-3">
                {doc.tiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative flex flex-col rounded-2xl p-8 transition-all duration-200 ${
                      tier.highlight
                        ? "border-2 border-teal-400 bg-[#0f1a19]"
                        : "border border-white/10 bg-[#0f0d18] hover:border-white/25"
                    }`}
                  >
                    {tier.highlight && (
                      <span className="absolute -top-3.5 left-8 rounded-full bg-teal-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#0f0d18]">
                        Most common
                      </span>
                    )}

                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">{tier.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{tier.duration}</p>

                    <p className="mt-4 text-sm leading-6 text-slate-300">{tier.description}</p>

                    <div className="mt-8 border-t border-white/10 pt-6">
                      <p className="font-playfair text-3xl font-bold tracking-tight text-slate-100">{tier.range}</p>
                      <p className="mt-1.5 text-xs text-slate-600">Fixed fee, scoped to the deliverable</p>
                    </div>

                    <ul className="mt-6 space-y-2">
                      {tier.examples.map((ex) => (
                        <li key={ex} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="mt-0.5 text-teal-400">•</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Payment structure */}
              <div className="mt-16">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">Payment structure</p>
                <h3 className="mt-3 font-playfair text-xl font-bold tracking-tight text-slate-100">
                  Three payments, tied to progress.
                </h3>

                <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  {doc.payment_steps.map((p, i) => (
                    <div key={p.title} className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400">
                      <p className="font-playfair text-2xl font-bold text-teal-400">{i + 1}</p>
                      <h4 className="mt-3 text-base font-bold text-slate-100">{p.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{p.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discovery sprint */}
              <div className="mt-16 rounded-2xl border border-white/10 bg-[#0f0d18] p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">Not sure yet?</p>
                <h3 className="mt-3 font-playfair text-xl font-bold tracking-tight text-slate-100">
                  {doc.discovery_sprint.title}
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {doc.discovery_sprint.description}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Terms / how engagements are structured */}
      <section className="border-b border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">How we work</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            We come, we build, we move on.
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {TERMS.map((t) => (
              <div key={t.title} className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400">
                <h3 className="text-lg font-bold text-slate-100">{t.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to scope an outcome?</h2>
            <p className="mt-2 text-white/70">
              Tell us the problem; we'll tell you whether we can help — and what it would take.
            </p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
          >
            Book a call →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}
