import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const DEMO_REQUEST_URL = "https://demo-awards.terian-services.com/demo/request";

export default function AwardNominationPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Product · AI/ML-assisted"
        title="Award Nomination System"
        description="Recognize the right people, faster — with an AI-assisted nomination workflow that catches bias, surfaces collusion, and drops approved awards directly into Workday."
        primaryCta={{ label: "Request a demo", href: DEMO_REQUEST_URL, target: "_blank", rel: "noreferrer" }}
        secondaryCta={{ label: "Talk to engineering", href: "mailto:sales@terian-services.com" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">What it does</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          A complete recognition workflow, built for the enterprise.
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Peer & manager nominations"
            description="Configurable nomination forms with category templates, eligibility rules, and rich text + attachments."
          />
          <Feature
            title="Multi-step approval chains"
            description="Manager → skip-level → HRBP → Comp partner. Routing, SLAs, and reminders built in."
          />
          <Feature
            title="Real-time dashboards"
            description="Pipeline view by status, category, business unit. Org-level recognition equity and trend reporting."
          />
          <Feature
            title="Full audit trail"
            description="Every state change, comment, and approver decision is captured. Exportable for audit and compliance."
          />
          <Feature
            title="Workday compensation events"
            description="Approved awards flow into Workday automatically as one-time payment events. No manual data entry."
          />
          <Feature
            title="Azure AD SSO + B2B"
            description="One-click sign-in for every employee. B2B guest access for partners, vendors, and demo environments."
          />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">AI/ML layer</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Recognition that knows when something looks off.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Most recognition platforms are forms with a database behind them. Ours has an ML layer
            watching the patterns in real time and flagging the ones that matter.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <MLCard
              title="Bias detection"
              description="Cohort-aware analysis of who's nominating whom. Surfaces under-recognized groups before they become a retention risk."
            />
            <MLCard
              title="Collusion & gaming"
              description="Graph analysis of nomination flows surfaces reciprocal patterns, ring structures, and approval shortcuts."
            />
            <MLCard
              title="Anomaly flagging"
              description="Statistical and embedding-based models flag nominations that deviate from organizational norms — wrong category, suspicious timing, copied language."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">How it works</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Four steps from intent to paycheck.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          <Step number="1" title="Nominate" description="Employee or manager submits with category, justification, and optional attachments." />
          <Step number="2" title="Approve" description="Routed through configured approval chain with SLAs, reminders, and audit logging." />
          <Step number="3" title="Audit" description="ML layer flags anomalies and bias risk. HRBP review queue handles exceptions." />
          <Step number="4" title="Pay" description="Approved awards post to Workday as compensation events. Recognition is delivered, payroll handles the rest." />
        </div>
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Integrations</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Wires into the systems your enterprise already runs.
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <IntegrationPill label="Microsoft Azure AD / Entra ID" />
            <IntegrationPill label="Workday Compensation" />
            <IntegrationPill label="Microsoft Graph" />
            <IntegrationPill label="Microsoft Teams" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Security & compliance</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Boring on purpose.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Pill label="Azure AD authentication" />
          <Pill label="Encryption at rest & in transit" />
          <Pill label="Region: Azure West US 2" />
          <Pill label="B2B guest access" />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-600">
          See our <a className="font-semibold text-teal-700 hover:text-teal-800" href="/trust">Trust & Security</a> page for the full posture.
        </p>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">See it on real data.</h2>
            <p className="mt-2 text-white/70">
              Demos run in a Microsoft Azure AD B2B tenant — your account, your data shape, sandbox-isolated.
            </p>
          </div>
          <a
            href={DEMO_REQUEST_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
          >
            Request a demo →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function MLCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-6">
      <h3 className="text-base font-bold text-teal-900">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-teal-900/80">{description}</p>
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

function IntegrationPill({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
      {label}
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
      {label}
    </div>
  );
}
