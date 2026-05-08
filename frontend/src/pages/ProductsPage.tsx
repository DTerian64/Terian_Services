import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const PRODUCTS = [
  {
    tag: "AI/ML-assisted",
    accent: "teal" as const,
    title: "Award Nomination System",
    description:
      "Streamlined peer recognition and manager-led award workflows with full audit trail, approval chains, real-time dashboards, and an ML layer that flags bias, collusion, and anomalous nomination patterns. Native integrations with Azure AD and Workday.",
    href: "/products/award-nomination",
    cta: "See the product",
  },
  {
    tag: "Coming Soon",
    accent: "indigo" as const,
    title: "Integrity Sentinel",
    description:
      "Productized fraud-detection SaaS — multi-tenant, configurable rule engine plus ML models for transactions, vendor master, and expense data. Pilot opening in 2026.",
    href: "/products/integrity-sentinel",
    cta: "Get notified",
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
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-8 transition hover:border-slate-300 hover:shadow-md"
            >
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  product.accent === "teal"
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-indigo-200 bg-indigo-50 text-indigo-800"
                }`}
              >
                {product.tag}
              </span>
              <h3 className="mt-5 text-2xl font-bold text-slate-950">{product.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{product.description}</p>
              <span className="mt-6 text-sm font-semibold text-teal-700 group-hover:text-teal-800">
                {product.cta} →
              </span>
            </a>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
