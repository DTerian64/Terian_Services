type PageHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryCta?: { label: string; href: string; target?: string; rel?: string };
  secondaryCta?: { label: string; href: string; target?: string; rel?: string };
};

export default function PageHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
}: PageHeroProps) {
  return (
    <section className="bg-[#0f0d18] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">{description}</p>
        ) : null}
        {(primaryCta || secondaryCta) && (
          <div className="mt-10 flex flex-wrap gap-3">
            {primaryCta ? (
              <a
                href={primaryCta.href}
                target={primaryCta.target}
                rel={primaryCta.rel}
                className="inline-flex items-center justify-center rounded-md bg-teal-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
              >
                {primaryCta.label} →
              </a>
            ) : null}
            {secondaryCta ? (
              <a
                href={secondaryCta.href}
                target={secondaryCta.target}
                rel={secondaryCta.rel}
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-teal-300 hover:text-teal-300"
              >
                {secondaryCta.label}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
