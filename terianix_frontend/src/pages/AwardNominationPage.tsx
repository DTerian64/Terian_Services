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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
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

function WorkflowNotificationsDrawer({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative flex h-full w-full max-w-2xl flex-col bg-[#0d0b1e] shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
              Workflow Notifications
            </p>
            <p className="mt-0.5 text-sm text-slate-400">Email samples — sandbox data</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close workflow notifications preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <img
            src="/awards-nomination-workflow-notification.png"
            alt="Workflow notifications — email samples from live sandbox"
            className="w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

function AuditLogDrawer({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative flex h-full w-full max-w-2xl flex-col bg-[#0d0b1e] shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
              Full Audit Trail
            </p>
            <p className="mt-0.5 text-sm text-slate-400">Nomination log — sample sandbox data</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close audit log preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <img
            src="/awards-nomination-log-analytics.png"
            alt="Full audit trail — nomination log screenshot from live sandbox"
            className="w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

function AnalyticsDrawer({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  // Trigger enter animation on the frame after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative flex h-full w-full max-w-2xl flex-col bg-[#0d0b1e] shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
              Analytics &amp; Reporting
            </p>
            <p className="mt-0.5 text-sm text-slate-400">Overview — sample sandbox data</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label="Close analytics preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {/* Scrollable image */}
        <div className="flex-1 overflow-y-auto p-4">
          <img
            src="/sandbox-awards.terianix.ai_analytics.png"
            alt="Analytics & Reporting — Overview screenshot from live sandbox"
            className="w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

export default function AwardNominationPage() {
  const [archOpen, setArchOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <PageLayout>
      {archOpen && <ArchitectureModal onClose={() => setArchOpen(false)} />}
      {workflowOpen && <WorkflowModal onClose={() => setWorkflowOpen(false)} />}
      {analyticsOpen && <AnalyticsDrawer onClose={() => setAnalyticsOpen(false)} />}
      {auditOpen && <AuditLogDrawer onClose={() => setAuditOpen(false)} />}
      {notificationsOpen && <WorkflowNotificationsDrawer onClose={() => setNotificationsOpen(false)} />}
      <PageHero
        eyebrow="Product · ML/AI Integrity-enforced"
        title="Award Nomination System"
        description="Peer-to-peer and manager-led recognition with ML/AI integrity enforcement baked in — bias detection and collusion surfacing run on every nomination, flagged cases are routed through human-in-the-loop HRBP review, then manager approval, before awards drop directly into your HR or payroll system."
        primaryCta={{ label: "Request a demo", href: DEMO_REQUEST_URL, target: "_blank", rel: "noreferrer" }}
        secondaryCta={{ label: "Talk to engineering", href: "mailto:sales@terian-services.com" }}
      />

      {/* ── Platform banner ── */}
      <section className="border-t border-white/10 bg-[#07060f]">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-4 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">What it does</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Award Nomination: Peer-to-Peer Recognition
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Configurable SaaS per tenant"
            description="Award categories, language, location, currency, and nomination limits are all configured per tenant. Every deployment is isolated — no shared data, no cross-tenant leakage."
          />
          <Feature
            title="Peer-to-peer nominations"
            description="Every submission feeds a Random Forest fraud model evaluating collusion patterns, financial anomalies, temporal signals, and semantic fit — before it reaches a human reviewer."
          />
          <Feature
            title="ML-scored, human-reviewed approval"
            description="ML fraud score computed across 18+ features — pair collusion rings, nomination concentration, amount anomalies, and semantic content. Flagged cases route to human-in-the-loop HRBP review → manager approval."
            onDetail={() => setWorkflowOpen(true)}
          />
          <Feature
            title="Full audit trail"
            description="Every state change, comment, and approver decision is captured. Exportable for audit and compliance."
            onSample={() => setAuditOpen(true)}
          />
          <Feature
            title="Workflow Notifications"
            description="Automated emails at every stage: nomination submitted, approval requested, fraud flag routed to HRBP, award approved, payout confirmed. Every stakeholder stays informed without manual follow-up."
            onSample={() => setNotificationsOpen(true)}
          />
          <Feature
            title="Analytics & Reporting"
            description="Nomination pipeline by status, category, and business unit. Recognition equity trends and manager-level breakdowns — exportable data for HR leadership and audit."
            onSample={() => setAnalyticsOpen(true)}
          />
          <Feature
            title="Real-time dashboards"
            description="Live platform telemetry: API requests, failure rate, P95 latency, active users, and compute health — refreshed every 5 minutes from the live sandbox."
            href="#live-metrics"
          />
          <Feature
            title="Azure AD SSO + B2B"
            description="One-click sign-in for every employee. B2B guest access for partners, vendors, and demo environments."
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">AI/ML layer</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">How it works</p>
          <span className="text-slate-600">·</span>
          <button
            onClick={() => setArchOpen(true)}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-violet-400"
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
          <Step number="4" title="Pay" description="Approved awards post to your HR or payroll system as compensation events. Recognition is delivered, payroll handles the rest." />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Integrations</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Wires into the systems your enterprise already runs.
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <IntegrationPill label="Microsoft Azure AD / Entra ID" />
            <IntegrationPill label="HR / Payroll" />
            <IntegrationPill label="Microsoft Graph" />
            <IntegrationPill label="Microsoft Teams" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">Security & compliance</p>
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
          See our <a className="font-semibold text-violet-400 hover:text-violet-300" href="/trust">Trust & Security</a> page for the full posture.
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
            className="inline-flex items-center justify-center rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-violet-400"
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
  onSample,
  onDetail,
}: {
  title: string;
  description: string;
  href?: string;
  onSample?: () => void;
  onDetail?: () => void;
}) {
  const inner = (
    <>
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
      {href && (
        <p className="mt-3 text-xs font-semibold text-violet-400">View live →</p>
      )}
      {onSample && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSample(); }}
          className="mt-3 text-xs font-semibold text-violet-400 transition hover:text-violet-300"
        >
          View sample →
        </button>
      )}
      {onDetail && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDetail(); }}
          className="mt-3 text-xs font-semibold text-violet-400 transition hover:text-violet-300"
        >
          View workflow →
        </button>
      )}
    </>
  );
  if (href) {
    return (
      <a href={href} className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6 block">
        {inner}
      </a>
    );
  }
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      {inner}
    </div>
  );
}

function MLCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-violet-400/30 bg-[#0f0d18] p-6 transition hover:border-violet-400">
      <h3 className="text-base font-bold text-violet-300">{title}</h3>
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
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 p-6">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function IntegrationPill({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-white/10 bg-[#0f0d18] transition hover:border-violet-400 px-4 py-3 text-sm font-semibold text-slate-200">
      {label}
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-md border-2 border-white/10 bg-[#0a0916] transition hover:border-violet-400 px-4 py-3 text-sm font-semibold text-slate-200">
      {label}
    </div>
  );
}
