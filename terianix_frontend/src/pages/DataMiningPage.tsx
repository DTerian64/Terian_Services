import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function DataMiningPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Service"
        title="Data Mining"
        description="Pattern discovery on the data you already have. We mine operational, financial, and HR datasets to surface segments, drivers, and risks worth acting on."
        primaryCta={{ label: "Talk to engineering", href: "/contact" }}
      />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">What it covers</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Three datasets where mining usually pays back fastest.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card
              title="Operational"
              description="Tickets, cases, incidents, and transactions. Find the drivers of cost, cycle time, and rework."
            />
            <Card
              title="Financial"
              description="Invoices, payables, receivables, expense reports. Find leakage, controls gaps, and pricing anomalies."
            />
            <Card
              title="HR / Workforce"
              description="Headcount, recognition, tenure, transfer history. Find equity gaps, attrition signals, and recognition patterns."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Methods</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            The toolkit, applied judiciously.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Method title="Feature extraction" description="Engineered features from raw operational and financial data, with documented derivations." />
            <Method title="Segmentation" description="Clustering and cohort analysis to find groups that behave differently — and why." />
            <Method title="Pattern discovery" description="Association rules, sequence mining, and graph traversal for hidden structure." />
            <Method title="Driver analysis" description="Mixed methods (regression, gradient boosting, SHAP) to attribute outcomes to drivers." />
          </div>
        </div>
      </section>

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Deliverables</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            What you walk away with.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Deliverable title="Findings memo" description="Written narrative — what's true in your data, what's surprising, and what's worth acting on." />
            <Deliverable title="Interactive dashboards" description="Power BI / Fabric or Looker workbooks pointed at the cleaned, modeled data so the findings stay live." />
            <Deliverable title="Reusable feature pipeline" description="Versioned SQL / dbt / Spark transforms so the next analyst doesn't start from zero." />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Sitting on data you haven't mined?</h2>
            <p className="mt-2 text-white/70">We'll find what's there in 4 weeks, fixed-price.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-violet-400"
          >
            Scope a pilot →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function Method({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-violet-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function Deliverable({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-violet-400/30 bg-[#0f0d18] p-6 transition hover:border-violet-400">
      <h3 className="text-base font-bold text-violet-300">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
