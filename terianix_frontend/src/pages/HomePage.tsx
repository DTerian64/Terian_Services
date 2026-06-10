import { useEffect } from "react";
import PageLayout from "../components/PageLayout";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** Fire-and-forget: wake CosmosDB before the user navigates to a page that needs it. */
function useApiWarmup() {
  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/api/team`, { method: "GET", signal: AbortSignal.timeout(15_000) })
      .catch(() => { /* warmup — errors are intentionally silent */ });
  }, []);
}

export default function HomePage() {
  useApiWarmup();
  return (
    <PageLayout>
      {/* Hero */}
      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            AI-powered enterprise SaaS
          </p>
          <h1 className="mt-5 font-playfair text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            AI analytics and integrity,
            <br />
            delivered as SaaS.
            <br />
            <span className="text-violet-300">Secure. Isolated. Provable.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-white/70">
            Terianix.ai, a sub-brand of <a href="https://terian-services.com" className="underline underline-offset-2 hover:text-violet-300">Terian Services</a>, builds AI-assisted SaaS for enterprises — intelligent analytics to surface
            patterns, and integrity tooling to detect fraud, collusion, and anomalous behaviour
            before it costs you. Every product we operate is built around three commitments: your
            data stays{" "}
            <strong className="font-semibold text-white">secure</strong> (encrypted, least-privilege,
            threat-monitored),{" "}
            <strong className="font-semibold text-white">isolated</strong> (hard tenant boundaries;
            data never crosses), and{" "}
            <strong className="font-semibold text-white">provable</strong> (full audit trail of
            every change, approval, and model decision).
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/products"
              className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-violet-400"
            >
              Explore Products →
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-violet-300 hover:text-violet-300"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-b border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <SectionHeading
            eyebrow="Multi-tenant · Multi-lingual · ML-native"
            title="Enterprise SaaS with intelligence baked into every layer."
            description="Terianix.ai builds multi-tenant, multi-lingual SaaS applications where the ML layer and AI analytics aren't add-ons — they're in the product's DNA. Every workflow we ship surfaces patterns, flags anomalies, and routes exceptions to the right human before damage is done. Built on Azure. Isolated by design. Auditable by default."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <ProductCard
              tag="AI/ML-assisted"
              title="Award Nomination System"
              description="Streamlined peer recognition and manager-led award workflows with full audit trail, approval chains, real-time dashboards, and an ML layer that flags bias, collusion, and anomalous nomination patterns. Native integrations with Azure AD and Workday."
              href="/products/award-nomination"
              ctaLabel="Try it now"
              accent="violet"
            />
            <ProductCard
              tag="Coming Soon"
              title="Integrity Sentinel"
              description="Productized fraud-detection SaaS — multi-tenant, configurable rule engine plus ML models for transactions, vendor master, and expense data. Get notified when we open the pilot."
              href="/products/integrity-sentinel"
              ctaLabel="Get notified"
              accent="indigo"
            />
          </div>
        </div>
      </section>

      {/* Why Terianix */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <SectionHeading
            eyebrow="Why Terianix"
            title="Enterprise instincts, SaaS delivery"
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ValueCard
              title="Azure-native"
              description="Built on Azure AD, Microsoft Graph, and the Microsoft data stack — adoption is friction-free across your tenant with no identity bridge required."
            />
            <ValueCard
              title="Audit-ready"
              description="Every action, approval, and model decision is logged. Compliance reports run in seconds, not days. No after-the-fact reconstruction."
            />
            <ValueCard
              title="AI-assisted"
              description="ML layers surface anomalies, flag risk, and accelerate workflows — without replacing human judgment or obscuring the reasoning."
            />
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to see it in action?</h2>
            <p className="mt-2 text-white/70">
              30 minutes, no slides. We'll walk you through the product live.
            </p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-violet-400"
          >
            Book a demo →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

// ── Reusable building blocks ─────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">{eyebrow}</p>
      <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 text-slate-300">{description}</p> : null}
    </div>
  );
}

function ProductCard({
  tag,
  title,
  description,
  href,
  ctaLabel,
  accent,
}: {
  tag: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  accent: "violet" | "indigo";
}) {
  const tagClasses =
    accent === "violet"
      ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
      : "border-indigo-400/30 bg-indigo-400/10 text-indigo-300";

  return (
    <a
      href={href}
      className="group flex flex-col rounded-xl border-2 border-white/10 bg-[#0f0d18] p-8 transition hover:border-violet-400"
    >
      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${tagClasses}`}>
        {tag}
      </span>
      <h3 className="mt-5 text-2xl font-bold text-slate-100">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
      <span className="mt-6 text-sm font-semibold text-violet-400 group-hover:text-violet-300">
        {ctaLabel} →
      </span>
    </a>
  );
}

function ValueCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-violet-400">
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
