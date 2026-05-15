import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const SERVICES = [
  {
    icon: "📊",
    title: "AI Analytics",
    description:
      "Custom ML models and analytics workflows on enterprise data — forecasting, classification, anomaly detection, NLP on unstructured text, embedding-based search.",
    href: "/services/ai-analytics",
  },
  {
    icon: "🛡️",
    title: "Integrity & Fraud Detection",
    description:
      "Systemic, business-process-aware fraud detection. Rule engines + statistical anomaly detection + graph analysis + ML models to surface patterns no manual review can.",
    href: "/services/integrity-fraud",
  },
  {
    icon: "⛏️",
    title: "Data Mining",
    description:
      "Discovery analytics on operational, financial, and HR datasets. Feature extraction, segmentation, pattern discovery, and dashboards.",
    href: "/services/data-mining",
  },
  {
    icon: "☁️",
    title: "Datacenter → Cloud Migration",
    description:
      "Lift-and-shift through full re-platforming. Azure-first, with assessment, landing-zone design, IaC, data migration, cutover, and post-migration optimization.",
    href: "/services/cloud-migration",
  },
  {
    icon: "⚙️",
    title: "MLOps & Model Governance",
    description:
      "Model registry, drift monitoring, evaluation harnesses, responsible-AI review. The infrastructure that keeps models trustworthy in production.",
    href: "/services/mlops",
  },
];

export default function ServicesPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Services"
        title="Engineering and analytics, delivered hands-on."
        description="Senior engineers from day one. We deliver custom AI/ML, fraud detection, data mining, and cloud modernization — wired into your environment, not handed off."
        primaryCta={{ label: "Book a 30-minute call", href: "/contact" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <a
              key={service.href}
              href={service.href}
              className="group flex h-full flex-col rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6 transition hover:border-white/30 hover:bg-white/[0.13]"
            >
              <div className="text-2xl">{service.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-slate-100">{service.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-slate-300">{service.description}</p>
              <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-teal-400 group-hover:text-teal-300">
                Learn more →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">How we engage</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            A simple, predictable engagement shape.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step
              number="1"
              title="Discovery (1–2 weeks)"
              description="Half-day workshop, data access review, baseline metric. We come back with a written scope, success criteria, and a fixed-price pilot proposal."
            />
            <Step
              number="2"
              title="Pilot (4–8 weeks)"
              description="Fixed-price, time-boxed engagement against the agreed success criteria. Production-shaped from day one — no throwaway demos."
            />
            <Step
              number="3"
              title="Production & operate"
              description="Hand-off package, runbooks, and monitoring. Optional ongoing engagement for tuning, governance, and new use cases."
            />
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 p-6">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
