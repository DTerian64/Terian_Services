import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function IntegrityFraudPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Service"
        title="Integrity & Fraud Detection"
        description="Systemic fraud doesn't show up in a single transaction. We combine rule engines, statistical anomaly detection, graph analysis, and ML models to find the patterns no human review can."
        primaryCta={{ label: "Book a fraud-risk discovery call", href: "/contact" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">The problem</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          The losses you see are a fraction of the losses you have.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Most fraud is systemic, not transactional. Collusion between approvers and vendors, ghost
          employees on payroll, duplicate payments hiding in different invoice formats, expense
          reports tuned just under thresholds — none of it surfaces from rules alone.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Vendor collusion" description="Approver-vendor relationships, kickback patterns, and round-tripping." />
          <Card title="Ghost vendors / employees" description="Master data anomalies, address overlaps, banking detail reuse." />
          <Card title="Duplicate payments" description="Near-duplicate invoices across formats, vendors, and currencies." />
          <Card title="Expense & benefit abuse" description="Threshold-tuning, repeated edge-cases, and fabricated receipts." />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Our methodology</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Four layers, working together.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Layer
              number="1"
              title="Rule engines"
              description="Codified controls, thresholds, and segregation-of-duties checks. The baseline that finds the obvious."
            />
            <Layer
              number="2"
              title="Statistical anomaly detection"
              description="Isolation forests, z-scores, time-series drift. Surfaces the not-obvious without labeled data."
            />
            <Layer
              number="3"
              title="Graph analysis"
              description="Network views of approvers, vendors, employees, and accounts. Finds rings, reciprocal patterns, and unexpected closeness."
            />
            <Layer
              number="4"
              title="ML models"
              description="Supervised classifiers trained on confirmed cases plus embedding-based similarity for invoices and free-text fields."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Engagement model</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Three phases, fixed-price pilot.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Step
            number="1"
            title="Risk assessment (2 weeks)"
            description="Workshops, data access review, and a written risk register prioritized by exposure and feasibility."
          />
          <Step
            number="2"
            title="Pilot (6–8 weeks)"
            description="Build the highest-priority detection on real historical data. Calibrate, validate against confirmed cases, and produce a triage queue."
          />
          <Step
            number="3"
            title="Production deployment"
            description="Wire detections into your environment with monitoring, retraining cadence, and an investigator workflow. Hand-off documentation included."
          />
        </div>
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Outcomes we target</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            We measure what matters.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Metric label="% of fraudulent dollars surfaced" />
            <Metric label="False-positive rate (vs. investigator review)" />
            <Metric label="Payback period of the program" />
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">30 minutes. No slides.</h2>
            <p className="mt-2 text-white/70">Tell us where you suspect leakage; we'll tell you what's testable.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
          >
            Book a discovery call →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function Layer({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
      <span className="text-xs font-bold text-teal-700">Layer {number}</span>
      <h3 className="mt-2 text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function Metric({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
    </div>
  );
}
