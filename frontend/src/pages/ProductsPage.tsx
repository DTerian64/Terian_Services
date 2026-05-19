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
];

export default function ProductsPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Products"
        title="SaaS we build, host, and operate."
        description="Production software grounded in real enterprise constraints — Azure-native, audit-ready, and AI-assisted from the inside out."
      />

      {/* ── Integrity Sentinel flagship hero banner ── */}
      <section className="relative overflow-hidden bg-[#0a0916]" style={{ minHeight: "360px" }}>
        <img
          src="/terian-services-banner.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
        />
        {/* gradient: solid left → transparent right so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0916] via-[#0a0916]/70 to-transparent" />
        <div className="relative mx-auto flex min-h-[360px] max-w-6xl flex-col justify-center px-6 py-16 lg:px-10">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
              Flagship Platform
            </p>
            <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              Coming Soon
            </span>
          </div>
          <h2 className="mt-4 font-playfair text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            Integrity Sentinel
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            AI-powered graph intelligence for fraud detection, collusion analysis, insider risk,
            and operational trust — purpose-built for enterprise integrity programs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/products/integrity-sentinel"
              className="inline-flex items-center justify-center rounded-md bg-teal-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-900 transition hover:bg-teal-300"
            >
              Explore the platform
            </a>
            <a
              href="mailto:sales@terian-services.com?subject=Integrity%20Sentinel%20early%20access"
              className="inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-teal-300 hover:text-teal-300"
            >
              Request early access
            </a>
          </div>
        </div>
      </section>

      {/* ── Other products ── */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Also available</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {PRODUCTS.map((product) => (
            <a
              key={product.href}
              href={product.href}
              className="group flex flex-col rounded-xl border border-white/15 bg-[#0f0d18] p-8 transition hover:border-2 hover:border-teal-400"
            >
              <span className="inline-flex w-fit rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                {product.tag}
              </span>
              <h3 className="mt-5 text-2xl font-bold text-slate-100">{product.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{product.description}</p>
              <span className="mt-6 text-sm font-semibold text-teal-400 group-hover:text-teal-300">
                {product.cta} →
              </span>
            </a>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
