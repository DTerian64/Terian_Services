import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import TeamSection from "../components/TeamSection";

export default function AboutPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="About"
        title="Engineering for the parts of the enterprise that matter."
        description="Terian Services builds AI/ML-empowered SaaS and delivering high-trust enterprise services. We work where the data is sensitive, the workflows are real, and the outcomes are measurable."
      />

      <section className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-3">
          <Pillar
            title="Products"
            description="AI/ML-empowered SaaS we build, host, and operate. Currently led by the Award Nomination System, with Integrity Sentinel on the roadmap."
          />
          <Pillar
            title="Services"
            description="Hands-on AI analytics, integrity & fraud detection, and data mining. Senior engineers, embedded with your team, shipping in production."
          />
          <Pillar
            title="Migrations"
            description="Datacenter-to-cloud transformation programs. Azure-first, Terraform-driven, with rollback plans written before we touch anything."
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">How we work</p>
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

      <TeamSection />

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Have a problem worth talking about?</h2>
            <p className="mt-2 text-white/70">We'll spend 30 minutes on it with you, no slides.</p>
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

function Pillar({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
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
