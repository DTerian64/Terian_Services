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

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">What it covers</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
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
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Methods</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
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

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Deliverables</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          What you walk away with.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Deliverable title="Findings memo" description="Written narrative — what's true in your data, what's surprising, and what's worth acting on." />
          <Deliverable title="Interactive dashboards" description="Power BI / Fabric or Looker workbooks pointed at the cleaned, modeled data so the findings stay live." />
          <Deliverable title="Reusable feature pipeline" description="Versioned SQL / dbt / Spark transforms so the next analyst doesn't start from zero." />
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
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
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
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function Method({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function Deliverable({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-6">
      <h3 className="text-base font-bold text-teal-900">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-teal-900/80">{description}</p>
    </div>
  );
}
