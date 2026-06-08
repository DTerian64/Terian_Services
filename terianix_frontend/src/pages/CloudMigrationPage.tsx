import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function CloudMigrationPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Service"
        title="Datacenter → Cloud Migration"
        description="From assessment to cutover to post-migration optimization. Azure-first, Terraform-driven, with a rollback plan written before we move anything."
        primaryCta={{ label: "Scope a migration", href: "/contact" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">The migration spectrum</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Six R's. We help you pick the right one per workload.
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <R title="Rehost" description="Lift and shift. Fastest path off the datacenter; minimal app changes." />
          <R title="Replatform" description="Lift and reshape. Move to managed databases, container hosts, and identity services." />
          <R title="Refactor" description="Rebuild for cloud-native patterns where the ROI justifies the rework." />
          <R title="Repurchase" description="Replace with SaaS where a market alternative is cheaper than running it yourself." />
          <R title="Retire" description="Identify and shut down workloads that nobody owns or uses." />
          <R title="Retain" description="Keep on-prem where compliance, latency, or licensing dictates. Hybrid by design." />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Our 5-phase method</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Predictable, instrumented, and rollback-ready at every step.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-5">
            <Phase number="1" title="Assess" description="Inventory, dependency mapping, TCO, risk register, R-decision per workload." />
            <Phase number="2" title="Design" description="Landing-zone architecture, IaC blueprint, identity & networking, data residency." />
            <Phase number="3" title="Migrate" description="Wave-based execution, data sync, cutover runbooks, rollback plans rehearsed." />
            <Phase number="4" title="Optimize" description="Rightsizing, reserved capacity, observability, FinOps baseline." />
            <Phase number="5" title="Operate" description="Runbooks, on-call rotation hand-off, incident playbooks, drift monitoring." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Stack</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Azure-first. IaC by default.
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pill label="Terraform / Bicep" />
          <Pill label="Azure Migrate" />
          <Pill label="Azure Arc (hybrid)" />
          <Pill label="Azure AD / Entra ID" />
          <Pill label="Azure Landing Zones" />
          <Pill label="Azure Monitor / Log Analytics" />
          <Pill label="Defender for Cloud" />
          <Pill label="GitHub Actions / Azure DevOps" />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300">
          This very site is deployed via Terraform on Azure Static Web Apps — same toolchain we'll
          use on yours.
        </p>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Risk & rollback</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Every cutover has a rehearsed reverse.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Bullet title="Wave-based execution" description="Smallest-blast-radius first. Each wave validates the runbook for the next." />
            <Bullet title="Data sync verified" description="Reconciliation queries on both sides; cutover only after row counts and checksums agree." />
            <Bullet title="Rollback rehearsed" description="The reverse path is run end-to-end in non-prod before we touch prod. No 'we'll figure it out.'" />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Tired of the datacenter?</h2>
            <p className="mt-2 text-white/70">Free 1-hour assessment of your top 10 workloads. We'll show you the R-decision matrix.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-violet-400"
          >
            Book the assessment →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function R({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function Phase({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-violet-400 p-5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
        {number}
      </span>
      <h3 className="mt-3 text-sm font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 px-4 py-3 text-sm font-semibold text-slate-200">
      {label}
    </div>
  );
}

function Bullet({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
