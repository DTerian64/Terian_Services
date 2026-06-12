import PageLayout from "../components/PageLayout";
import TeamSection from "../components/TeamSection";

export default function AboutPage() {
  return (
    <PageLayout>
      <section>
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-10 lg:py-24">
          <h1 className="font-playfair text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">About Terianix.ai</h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            An Azure-native engineering team building the integrity layer for enterprise data.
          </p>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-20 lg:px-10 lg:pb-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-violet-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our mission</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Our mission is to make integrity the default state of enterprise data. We set out to build the integrity layer enterprises wrap around their most sensitive workflows — awards, expenses, vendor payments — so bias and fraud are caught before they cost, and honest work is never in doubt.
              </p>
            </div>
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-violet-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our vision</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Enterprise software where integrity is part of the architecture, not an afterthought. We see a future where every transaction, record, and decision is verifiable by design — and where machine learning quietly does the auditing that organizations today do manually, late, or not at all. Our vision is to make AI-enforced integrity standard infrastructure, the same way encryption and access control became standard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TeamSection />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">How we build</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Principles that shape every system we deliver.
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Habit
              title="Multi-tenant from the ground up"
              description="Security, data isolation, and per-tenant configurability aren't features we added — they're the foundation. Every tenant gets its own isolated data, its own configuration, and its own trained model."
            />
            <Habit
              title="Measurable, observable, traceable"
              description="Instrumentation is part of development, not a post-launch chore. Every release ships with metrics, distributed tracing, and dashboards already wired in."
            />
            <Habit
              title="The right model for the problem"
              description="Random Forest, XGBoost, LightGBM — we maintain multiple ML approaches and pick per problem, per tenant. No one-size-fits-all model pretending to fit all."
            />
            <Habit
              title="Never finished"
              description="Models retrain as data grows. Features ship continuously. The product you buy improves every month you run it."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Like what you see?</h2>
            <p className="mt-2 text-white/70">Let's talk about Award Nomination, Integrity Sentinel, or working together.</p>
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
