type HeroCta = {
  label: string;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
};

type PageHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  tertiaryCta?: HeroCta;
};

function PrimaryHeroCta({ cta }: { cta: HeroCta }) {
  const className =
    "inline-flex items-center justify-center rounded-md bg-violet-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-violet-400";
  return cta.href ? (
    <a href={cta.href} target={cta.target} rel={cta.rel} className={className}>
      {cta.label} →
    </a>
  ) : (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.label} →
    </button>
  );
}

function SecondaryHeroCta({ cta }: { cta: HeroCta }) {
  const className =
    "inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-violet-300 hover:text-violet-300";
  return cta.href ? (
    <a href={cta.href} target={cta.target} rel={cta.rel} className={className}>
      {cta.label}
    </a>
  ) : (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.label}
    </button>
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
