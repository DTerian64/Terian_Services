import PageLayout from "../components/PageLayout";
import TeamSection from "../components/TeamSection";

export default function AboutPage() {
  return (
    <PageLayout>
      <section>
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-10 lg:py-24">
          <h1 className="font-playfair text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">About Terian Services</h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Full-spectrum SDLC consulting for the enterprise.
            <br />
            From product definition to delivery and support.
            <br />
            Plus SaaS products via our{" "}
            <a href="https://terianix.ai" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">
              Terianix.ai
            </a>{" "}
            sub-brand.
          </p>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-20 lg:px-10 lg:pb-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-teal-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our mission</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Our mission is to give enterprises senior engineering talent on demand — full-lifecycle consulting across design, development, project management, and product ownership, delivered by the people who scoped the engagement. Through our Terianix.ai sub-brand, we apply that same discipline to the SaaS products we build and operate ourselves, including the Award Nomination System and Integrity Sentinel.
              </p>
            </div>
            <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-teal-400">
              <h2 className="font-playfair text-lg font-bold text-slate-100">Our vision</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                We see a future where enterprises don't have to choose between hiring permanent headcount and accepting open-ended consulting retainers. Our vision is to be the team organizations call for a defined engagement — from initial design through to product ownership — with the same engineering rigor carried into the SaaS products we ship under Terianix.ai.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TeamSection />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">How we build and operate</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Principles that shape every system we deliver.
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Habit
              title="Secure and isolated by default"
              description="Security, data isolation, and configurability are the foundation. Every system we build separates data and access by default, and is configurable to fit how you operate."
            />
            <Habit
              title="Measurable, observable, traceable"
              description="Instrumentation is part of development, not a post-launch chore. Every release ships with metrics, distributed tracing, and dashboards already wired in."
            />
            <Habit
              title="AI-empowered, AI-guarded"
              description="Random Forest, XGBoost, LightGBM, and modern LLMs — we pick the right approach per problem, and pair AI-assisted automation with guardrails and human review. AI accelerates the work; it doesn't run unsupervised."
            />
            <Habit
              title="Predictable by design"
              description="Fixed-fee engagements, scoped upfront. You know the cost before we start, and that's the cost when we finish — no open-ended retainers, no runaway budgets."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Like what you see?</h2>
            <p className="mt-2 text-white/70">Ready to scope an engagement? Let's talk — and feel free to ask about our SaaS products, Award Nomination and Integrity Sentinel.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
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
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
