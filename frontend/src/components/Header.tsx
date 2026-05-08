import { useState, type Dispatch, type SetStateAction } from "react";

type MenuItem = { label: string; href: string; badge?: string };

const PRODUCT_ITEMS: MenuItem[] = [
  { label: "Award Nomination System", href: "/products/award-nomination" },
  { label: "Integrity Sentinel", href: "/products/integrity-sentinel", badge: "Coming Soon" },
];

const SERVICE_ITEMS: MenuItem[] = [
  { label: "AI Analytics", href: "/services/ai-analytics" },
  { label: "Integrity & Fraud Detection", href: "/services/integrity-fraud" },
  { label: "Data Mining", href: "/services/data-mining" },
  { label: "Datacenter → Cloud Migration", href: "/services/cloud-migration" },
  { label: "MLOps & Model Governance", href: "/services/mlops" },
];

const NAV_ITEMS: MenuItem[] = [
  { label: "About", href: "/about" },
  { label: "Trust", href: "/trust" },
  { label: "Contact", href: "/contact" },
];

const ASK_AI_ITEM: MenuItem = { label: "Ask AI", href: "/ask-ai" };

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0d18] text-white">
      <div className="mx-auto flex h-[5.4rem] max-w-7xl items-center justify-between px-6 lg:px-10">
        <a href="/" className="flex items-center gap-4 text-white no-underline" aria-label="Terian Services home">
          <img src="/terian_services_logo.png" alt="" className="-my-1 h-[3.6rem] w-auto object-contain" />
          <span className="text-2xl font-bold tracking-normal">Terian Services</span>
        </a>

        <nav className="hidden items-center gap-10 text-[15px] font-semibold text-white lg:flex" aria-label="Primary navigation">
          <Dropdown
            label="Products"
            items={PRODUCT_ITEMS}
            open={productsOpen}
            setOpen={setProductsOpen}
            onOpen={() => setServicesOpen(false)}
            widthClass="w-80"
          />
          <Dropdown
            label="Services"
            items={SERVICE_ITEMS}
            open={servicesOpen}
            setOpen={setServicesOpen}
            onOpen={() => setProductsOpen(false)}
            widthClass="w-[22rem]"
          />

          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="py-3 text-white transition hover:text-teal-300">
              {item.label}
            </a>
          ))}

          <a
            href={ASK_AI_ITEM.href}
            className="inline-flex items-center gap-2 rounded-md px-1 py-3 text-[15px] font-bold text-white transition hover:text-teal-300"
          >
            <SparkleIcon />
            {ASK_AI_ITEM.label}
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/15 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-white/10 bg-[#0f0d18] px-6 pb-6 pt-2 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto max-w-7xl space-y-1">
            <MobileGroup label="Products" items={PRODUCT_ITEMS} onNavigate={() => setMenuOpen(false)} />
            <MobileGroup label="Services" items={SERVICE_ITEMS} onNavigate={() => setMenuOpen(false)} />

            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-md px-3 py-3 text-base font-semibold text-white transition hover:bg-white/10 hover:text-teal-300"
              >
                {item.label}
              </a>
            ))}

            <a
              href={ASK_AI_ITEM.href}
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-md px-3 py-3 text-base font-bold text-white transition hover:bg-white/10 hover:text-teal-300"
            >
              <SparkleIcon />
              {ASK_AI_ITEM.label}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Dropdown({
  label,
  items,
  open,
  setOpen,
  onOpen,
  widthClass,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onOpen: () => void;
  widthClass: string;
}) {
  const showMenu = () => {
    onOpen();
    setOpen(true);
  };

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-1 py-3 text-white transition hover:text-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          onOpen();
          setOpen((value) => !value);
        }}
      >
        {label}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className={`absolute left-0 top-full ${widthClass} rounded-md border border-white/10 bg-[#151321] p-2 shadow-2xl shadow-black/30`} role="menu">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded px-4 py-3 text-sm text-white/90 transition hover:bg-white/10 hover:text-teal-300"
              role="menuitem"
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                  {item.badge}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileGroup({ label, items, onNavigate }: { label: string; items: MenuItem[]; onNavigate: () => void }) {
  return (
    <div>
      <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-widest text-white/45">{label}</p>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="flex items-center justify-between rounded-md px-3 py-3 text-base font-semibold text-white transition hover:bg-white/10 hover:text-teal-300"
        >
          <span>{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
              {item.badge}
            </span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${className}`} fill="none">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-teal-400" fill="currentColor">
      <path d="M12.4 3.1a.75.75 0 0 1 1.2 0l1.9 2.8a.75.75 0 0 0 .5.3l3.2.8a.75.75 0 0 1 .3 1.3l-2.1 1.8a.75.75 0 0 0-.2.7l.5 3.1a.75.75 0 0 1-1.1.8l-3-1.5a.75.75 0 0 0-.7 0l-3 1.5a.75.75 0 0 1-1.1-.8l.5-3.1a.75.75 0 0 0-.2-.7L7 8.3A.75.75 0 0 1 7.3 7l3.2-.8a.75.75 0 0 0 .5-.3l1.4-2.8Z" />
      <path d="M5.2 12.2a.6.6 0 0 1 1 0l.7 1.2a.6.6 0 0 0 .3.3l1.2.7a.6.6 0 0 1 0 1l-1.2.7a.6.6 0 0 0-.3.3l-.7 1.2a.6.6 0 0 1-1 0l-.7-1.2a.6.6 0 0 0-.3-.3L3 15.4a.6.6 0 0 1 0-1l1.2-.7a.6.6 0 0 0 .3-.3l.7-1.2ZM18.6 2.5a.5.5 0 0 1 .8 0l.4.7a.5.5 0 0 0 .2.2l.7.4a.5.5 0 0 1 0 .8l-.7.4a.5.5 0 0 0-.2.2l-.4.7a.5.5 0 0 1-.8 0l-.4-.7a.5.5 0 0 0-.2-.2l-.7-.4a.5.5 0 0 1 0-.8l.7-.4a.5.5 0 0 0 .2-.2l.4-.7Z" />
    </svg>
  );
}
