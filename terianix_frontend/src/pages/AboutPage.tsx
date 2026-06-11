import PageLayout from "../components/PageLayout";
import TeamSection from "../components/TeamSection";

export default function AboutPage() {
  return (
    <PageLayout>
      <section>
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-10 lg:py-24">
          <h1 className="font-playfair text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">About Terianix</h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            The team, the philosophy, and why we build the way we do.
          </p>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-20 lg:px-10 lg:pb-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-violet-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our mission</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Is to build the integrity layer enterprises wrap around their most sensitive workflows — awards, expenses, vendor payments — so bias and fraud get caught before they cost you.
              </p>
            </div>
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-violet-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our vision</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Is to make ML/AI-enforced integrity standard infrastructure for enterprise software, the same way encryption and access control became standard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TeamSection />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">How we work</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Four habits we don't compromise on.
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Habit
              title="Security by default"
              description="Azure AD authentication, encryption at rest and in transit, least-privilege access, and audit trails on every state change. The boring stuff, done early."
            />
            <Habit
              title="Measure everything"
              description="If we can't tell whether the change made things better, we don't ship it. Every engagement has a baseline metric and a target."
            />
            <Habit
              title="Ship in production"
              description="Demos die in dev. We work toward production from day one — feature flags, staged rollouts, observability wired in."
            />
            <Habit
              title="Right-size the solution"
              description="A LightGBM model and a SQL view often beat a deep learning architecture. We pick the smallest tool that solves the problem."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Have a problem worth talking about?</h2>
            <p className="mt-2 text-white/70">We'll spend 30 minutes on it with you, no slides.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-violet-400"
          >
            Get in touch →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Habit({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
