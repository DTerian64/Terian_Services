type HeroCta = {
  label: string;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  tooltip?: string;
};

type PageHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  tertiaryCta?: HeroCta;
};

function CtaTooltip({ text }: { text: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-violet-400/30 bg-slate-800 px-3 py-2 text-xs font-normal normal-case leading-5 text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 delay-0 group-hover:opacity-100 group-hover:delay-500"
    >
      {text}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  );
}

function PrimaryHeroCta({ cta }: { cta: HeroCta }) {
  const className =
    "inline-flex items-center justify-center rounded-md bg-violet-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-violet-400";
  const content = cta.href ? (
    <a href={cta.href} target={cta.target} rel={cta.rel} className={className}>
      {cta.label} →
    </a>
  ) : (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.label} →
    </button>
  );
  if (!cta.tooltip) return content;
  return (
    <div className="group relative inline-flex">
      {content}
      <CtaTooltip text={cta.tooltip} />
    </div>
  );
}

function SecondaryHeroCta({ cta }: { cta: HeroCta }) {
  const className =
    "inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-violet-300 hover:text-violet-300";
  const content = cta.href ? (
    <a href={cta.href} target={cta.target} rel={cta.rel} className={className}>
      {cta.label}
    </a>
  ) : (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.label}
    </button>
  );
  if (!cta.tooltip) return content;
  return (
    <div className="group relative inline-flex">
      {content}
      <CtaTooltip text={cta.tooltip} />
    </div>
  );
}

export default function PageHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  tertiaryCta,
}: PageHeroProps) {
  return (
    <section className="bg-[#0f0d18] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">{eyebrow}</p>
        <h1 className="mt-4 font-playfair text-3xl font-bold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">{description}</p>
        ) : null}
        {(primaryCta || secondaryCta || tertiaryCta) && (
          <div className="mt-10 flex flex-wrap gap-3">
            {primaryCta ? <PrimaryHeroCta cta={primaryCta} /> : null}
            {secondaryCta ? <SecondaryHeroCta cta={secondaryCta} /> : null}
            {tertiaryCta ? <SecondaryHeroCta cta={tertiaryCta} /> : null}
          </div>
        )}
      </div>
    </section>
  );
}
