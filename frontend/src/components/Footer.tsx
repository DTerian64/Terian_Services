type LinkItem = { label: string; href: string };

const PRODUCTS: LinkItem[] = [
  { label: "Award Nomination System", href: "/products/award-nomination" },
  { label: "Integrity Sentinel (Coming Soon)", href: "/products/integrity-sentinel" },
];

const SERVICES: LinkItem[] = [
  { label: "AI Analytics", href: "/services/ai-analytics" },
  { label: "Integrity & Fraud Detection", href: "/services/integrity-fraud" },
  { label: "Data Mining", href: "/services/data-mining" },
  { label: "Cloud Migration", href: "/services/cloud-migration" },
  { label: "MLOps & Model Governance", href: "/services/mlops" },
];

const COMPANY: LinkItem[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Trust & Security", href: "/trust" },
];

const LEGAL: LinkItem[] = [
  { label: "Privacy Notice", href: "/privacy" },
];

export default function Footer() {
  return (
    <footer className="mt-auto bg-[#0f0d18] text-white/70">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-3 text-white no-underline">
              <img src="/terian_services_logo.svg" alt="" className="h-10 w-auto object-contain" />
              <span className="text-lg font-bold">Terian Services</span>
            </a>
            <p className="mt-4 text-sm leading-6 text-white/60">
              AI-empowered enterprise software & services. Engineering-led, Azure-native, anchored to outcomes.
            </p>
          </div>

          <FooterColumn title="Products" items={PRODUCTS} />
          <FooterColumn title="Services" items={SERVICES} />
          <FooterColumn title="Company" items={COMPANY} />
          <FooterColumn title="Legal" items={LEGAL} />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center">
          <span>&copy; {new Date().getFullYear()} Terian Services. All rights reserved.</span>
          <a href="mailto:support@terian-services.com" className="text-white/60 hover:text-teal-300">
            support@terian-services.com
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: LinkItem[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50">{title}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="text-white/75 transition hover:text-teal-300">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
