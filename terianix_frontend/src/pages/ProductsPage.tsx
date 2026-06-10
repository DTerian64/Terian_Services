import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const PRODUCTS = [
  {
    tag: "AI/ML-assisted",
    accent: "violet" as const,
    title: "Award Nomination System",
    description:
      "Streamlined peer recognition and manager-led award workflows with full audit trail, approval chains, real-time dashboards, and an ML layer that flags bias, collusion, and anomalous nomination patterns. Native integrations with Azure AD and Workday.",
    href: "/products/award-nomination",
    cta: "Explore product",
  },
  {
    tag: "Coming Soon",
    accent: "indigo" as const,
    title: "Integrity Sentinel",
    description:
      "Productized fraud-detection SaaS — multi-tenant, configurable rule engine plus ML models for transactions, vendor master, and expense data. Pilot opening in 2026.",
    href: "/products/integrity-sentinel",
    cta: "Explore product",
  },
];

export default function ProductsPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Products"
        title="SaaS we build, host, and operate."
        description="Production software grounded in real enterprise constraints — Azure-native, audit-ready, and AI-assisted from the inside out."
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="grid gap-6 md:grid-cols-2">
          {PRODUCTS.map((product) => (
            <a
              key={product.href}
              href={product.href}
              className="group flex flex-col rounded-xl border border-white/15 bg-[#0f0d18] p-8 transition hover:border-2 hover:border-violet-400"
            >
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  product.accent === "violet"
                    ? "border-violet-400/30 bg-violet-500/10 text-violet-300"
                    : "border-indigo-400/30 bg-indigo-400/10 text-indigo-300"
                }`}
              >
                {product.tag}
              </span>
              <h3 className="mt-5 text-2xl font-bold text-slate-100">{product.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{product.description}</p>
              <span className="mt-6 text-sm font-semibold text-violet-400 group-hover:text-violet-300">
                {product.cta} →
              </span>
            </a>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
