import PageLayout from "../components/PageLayout";

export default function HomePage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            Enterprise software & services
          </p>
          <h1 className="mt-5 font-playfair text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            AI-empowered enterprise software
            <br />
            and data analytics.
            <br />
            <span className="text-teal-300">Secure. Isolated. Provable.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-white/70">
            Terian Services builds AI/ML-empowered SaaS and delivers AI analytics, integrity &
            fraud detection, and cloud modernization for the enterprise. Every product we ship and
            every engagement we run is built around three commitments: your data stays{" "}
            <strong className="font-semibold text-white">secure</strong> (encrypted, least-privilege,
            threat-monitored),{" "}
            <strong className="font-semibold text-white">isolated</strong> (hard tenant boundaries;
            data never crosses), and{" "}
            <strong className="font-semibold text-white">provable</strong> (full audit trail of
            every change, approval, and model decision).
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
            >
              Request a Demo →
            </a>
            <a
              href="/services"
              className="inline-flex items-center justify-center rounded-md border border-white/20 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-teal-300 hover:text-teal-300"
            >
              Explore Services
            </a>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-b border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <SectionHeading
            eyebrow="Products"
            title="SaaS we build, host, and operate"
            description="Production software grounded in real enterprise constraints — Azure AD native, audit-ready, and AI-assisted from the inside out."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <ProductCard
              tag="AI/ML-assisted"
              title="Award Nomination System"
              description="Streamlined peer recognition and manager-led award workflows with full audit trail, approval chains, real-time dashboards, and an ML layer that flags bias, collusion, and anomalous nomination patterns. Native integrations with Azure AD and Workday."
              href="/products/award-nomination"
              ctaLabel="See the product"
              accent="teal"
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

      {/* Services */}
      <section id="services">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <SectionHeading
            eyebrow="Services"
            title="Engineering and analytics, delivered hands-on"
            description="Senior engineers from day one. We deliver custom AI/ML, fraud detection, data mining, and cloud modernization — wired into your environment, not handed off."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <ServiceCard
              icon="📊"
              title="AI Analytics"
              description="Forecasting, classification, anomaly detection, NLP, and embedding-based search — productionized, monitored, explainable."
              href="/services/ai-analytics"
            />
            <ServiceCard
              icon="🛡️"
              title="Integrity & Fraud Detection"
              description="Rule engines + statistical anomaly detection + graph analysis + ML to surface collusion, ghost vendors, duplicate payments, and benefit abuse."
              href="/services/integrity-fraud"
            />
            <ServiceCard
              icon="⛏️"
              title="Data Mining"
              description="Pattern discovery on operational, financial, and HR datasets. Feature extraction, segmentation, and dashboards you can act on."
              href="/services/data-mining"
            />
            <ServiceCard
              icon="☁️"
              title="Cloud Migration"
              description="Datacenter to Azure — assessment, landing zone, IaC, data migration, cutover, and post-migration optimization."
              href="/services/cloud-migration"
            />
          </div>

          <div className="mt-8">
            <a
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300"
            >
              See all services →
            </a>
          </div>
        </div>
      </section>

      {/* Why Terian */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <SectionHeading
            eyebrow="Why Terian"
            title="An engineering firm with enterprise instincts"
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ValueCard
              title="Engineering-led"
              description="Senior engineers from day one. No offshore handoff, no junior shadow team — the people writing the code are the people on the call."
            />
            <ValueCard
              title="Azure-native"
              description="We build on Azure AD, Workday, Microsoft Graph, and the Microsoft data stack so adoption is friction-free across your tenant."
            />
            <ValueCard
              title="Outcome-anchored"
              description="Every engagement starts with the metric we're moving and ends with proof we moved it. No vanity dashboards, no dead reports."
            />
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Ready to talk to engineering?</h2>
            <p className="mt-2 text-white/70">
              30 minutes, no slides. Tell us the problem; we'll tell you whether we can help.
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">{eyebrow}</p>
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
  accent: "teal" | "indigo";
}) {
  const accentClasses =
    accent === "teal"
      ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
      : "border-indigo-400/30 bg-indigo-400/10 text-indigo-300";

  return (
    <a
      href={href}
      className="group flex flex-col rounded-xl border-2 border-white/10 bg-[#0f0d18] p-8 transition hover:border-teal-400"
    >
      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${accentClasses}`}>
        {tag}
      </span>
      <h3 className="mt-5 text-2xl font-bold text-slate-100">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
      <span className="mt-6 text-sm font-semibold text-teal-400 group-hover:text-teal-300">
        {ctaLabel} →
      </span>
    </a>
  );
}

function ServiceCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex h-full flex-col rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400"
    >
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-4 text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-300">{description}</p>
      <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-teal-400 group-hover:text-teal-300">
        Learn more →
      </span>
    </a>
  );
}

function ValueCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
