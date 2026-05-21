import { useState, useEffect } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import AwardMetrics from "../components/AwardMetrics";

const DEMO_REQUEST_URL = "https://demo-awards.terian-services.com/demo/request";

function ArchitectureModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#0f172a] shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
              Technical Architecture
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              Award Nomination System · Azure infrastructure
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close architecture diagram"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {/* Diagram */}
        <div className="overflow-auto p-6">
          <img
            src="/award_nomination_architecture.svg"
            alt="Award Nomination System technical architecture diagram"
            className="mx-auto w-full"
          />
        </div>
      </div>
    </div>
  );
}

function WorkflowModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#0f172a] shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
              Approval Workflow
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              Multi-step approval chain · HRBP fraud review routing
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close workflow diagram"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {/* Diagram */}
        <div className="overflow-auto p-6">
          <img
            src="/hrbp_fraud_review_workflow.svg"
            alt="Multi-step approval chain — HRBP fraud review workflow diagram"
            className="mx-auto w-full"
          />
        </div>
      </div>
    </div>
  );
}

export default function AwardNominationPage() {
  const [archOpen, setArchOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  return (
    <PageLayout>
      {archOpen && <ArchitectureModal onClose={() => setArchOpen(false)} />}
      {workflowOpen && <WorkflowModal onClose={() => setWorkflowOpen(false)} />}
      <PageHero
        eyebrow="Product · AI/ML-assisted"
        title="Award Nomination System"
        description="Recognize the right people, faster — with an AI-assisted nomination workflow that catches bias, surfaces collusion, and drops approved awards directly into Workday."
        primaryCta={{ label: "Request a demo", href: DEMO_REQUEST_URL, target: "_blank", rel: "noreferrer" }}
        secondaryCta={{ label: "Talk to engineering", href: "mailto:sales@terian-services.com" }}
      />

      {/* ── Platform banner ── */}
      <section className="border-t border-white/10 bg-[#07060f]">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-4 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
            Award Nomination System — Platform Overview
          </p>
        </div>
        <div className="overflow-hidden">
          <img
            src="/award-nomination-banner.svg"
            alt="Award Nomination System — five-step workflow with ML intelligence, audit trail, and Azure integrations"
            className="w-full object-cover"
            style={{ maxHeight: "420px", objectPosition: "center 30%" }}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">What it does</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
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
            onDetail={() => setWorkflowOpen(true)}
          />
          <Feature
            title="Real-time dashboards"
            description="Pipeline view by status, category, business unit. Org-level recognition equity and trend reporting."
            href="#live-metrics"
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

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">AI/ML layer</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Recognition that knows when something looks off.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Most recognition platforms are forms with a database behind them. Ours has an ML layer
            watching the patterns in real time and flagging the ones that matter.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            <MLCard
              title="Decision provenance"
              description="Every flag is traceable to the model version and inputs that produced it, with explanation layers reviewable in the HRBP queue. Tenant-isolated by default — your data never trains another customer's model."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">How it works</p>
          <span className="text-slate-600">·</span>
          <button
            onClick={() => setArchOpen(true)}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-teal-400"
          >
            Technical Architecture
          </button>
        </div>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Four steps from intent to paycheck.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          <Step number="1" title="Nominate" description="Employee or manager submits with category, justification, and optional attachments." />
          <Step number="2" title="Approve" description="Routed through configured approval chain with SLAs, reminders, and audit logging." />
          <Step number="3" title="Audit" description="ML layer flags anomalies and bias risk. HRBP review queue handles exceptions." />
          <Step number="4" title="Pay" description="Approved awards post to Workday as compensation events. Recognition is delivered, payroll handles the rest." />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Integrations</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Security & compliance</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Boring on purpose.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Pill label="Azure AD authentication" />
          <Pill label="Encryption at rest & in transit" />
          <Pill label="Region: Azure West US 2" />
          <Pill label="B2B guest access" />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300">
          See our <a className="font-semibold text-teal-400 hover:text-teal-300" href="/trust">Trust & Security</a> page for the full posture.
        </p>
      </section>

      <div id="live-metrics">
        <AwardMetrics />
      </div>

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
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-teal-300"
          >
            Request a demo →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Feature({
  title,
  description,
  href,
  onDetail,
}: {
  title: string;
  description: string;
  href?: string;
  onDetail?: () => void;
}) {
  const inner = (
    <>
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
      {href && (
        <p className="mt-3 text-xs font-semibold text-teal-400">View live →</p>
      )}
      {onDetail && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDetail(); }}
          className="mt-3 text-xs font-semibold text-teal-400 transition hover:text-teal-300"
        >
          View workflow →
        </button>
      )}
    </>
  );
  if (href) {
    return (
      <a href={href} className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6 block">
        {inner}
      </a>
    );
  }
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      {inner}
    </div>
  );
}

function MLCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-teal-400/30 bg-[#0f0d18] p-6 transition hover:border-teal-400">
      <h3 className="text-base font-bold text-teal-300">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
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
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function IntegrationPill({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 px-4 py-3 text-sm font-semibold text-slate-200">
      {label}
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 px-4 py-3 text-sm font-semibold text-slate-200">
      {label}
    </div>
  );
}
