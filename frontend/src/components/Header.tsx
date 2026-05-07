import { useState, type Dispatch, type SetStateAction } from "react";

type MenuItem = { label: string; href: string };

const PRODUCT_ITEMS: MenuItem[] = [
  { label: "Award Nomination System", href: "/award_nomination" },
];

const SOLUTION_ITEMS: MenuItem[] = [
  { label: "Systemic Fraud Detection - Data Mining", href: "/systemic_fraud_detection" },
];

const NAV_ITEMS: MenuItem[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0d18] text-white">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 lg:px-10">
        <a href="/" className="flex items-center gap-4 text-white no-underline" aria-label="Terian Services home">
          <img src="/terian_services_logo.png" alt="" className="-my-2 h-16 w-16 rounded-full object-contain" />
          <span className="text-2xl font-bold tracking-normal">Terian Services</span>
        </a>

        <nav className="hidden items-center gap-12 text-[15px] font-semibold text-white lg:flex" aria-label="Primary navigation">
          <Dropdown
            label="Products"
            items={PRODUCT_ITEMS}
            open={productsOpen}
            setOpen={setProductsOpen}
            onOpen={() => setSolutionsOpen(false)}
            widthClass="w-72"
          />
          <Dropdown
            label="Solutions"
            items={SOLUTION_ITEMS}
            open={solutionsOpen}
            setOpen={setSolutionsOpen}
            onOpen={() => setProductsOpen(false)}
            widthClass="w-80"
          />

          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="py-3 text-white transition hover:text-teal-300">
              {item.label}
            </a>
          ))}
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
            <MobileGroup label="Solutions" items={SOLUTION_ITEMS} onNavigate={() => setMenuOpen(false)} />

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
              className="block rounded px-4 py-3 text-sm text-white/90 transition hover:bg-white/10 hover:text-teal-300"
              role="menuitem"
            >
              {item.label}
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
          className="block rounded-md px-3 py-3 text-base font-semibold text-white transition hover:bg-white/10 hover:text-teal-300"
        >
          {item.label}
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
