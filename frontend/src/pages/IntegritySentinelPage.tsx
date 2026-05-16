import PageLayout from "../components/PageLayout";

const CONTACT_HREF = "mailto:sales@terian-services.com?subject=Integrity%20Sentinel%20discussion";

const signalStats = [
  { label: "Risk score", value: "87/100" },
  { label: "Similarity", value: "92%" },
  { label: "Network", value: "4 clusters" },
];

const capabilities = [
  {
    title: "Enterprise Integrity Graph",
    description:
      "Model employees, vendors, approvals, reimbursements, devices, transactions, documents, and departments as one connected operational map.",
  },
  {
    title: "Behavioral Risk Intelligence",
    description:
      "Establish baselines for approval patterns, spending behavior, access signals, workflow timing, semantic similarity, and coordination drift.",
  },
  {
    title: "Sentinel AI Investigator",
    description:
      "Summarize anomalies, explain contributing factors, correlate evidence, generate narratives, and recommend next investigative actions.",
  },
  {
    title: "Continuous Integrity Monitoring",
    description:
      "Move from quarterly reviews toward near-real-time visibility into fraud, collusion, policy circumvention, and operational abuse.",
  },
  {
    title: "Investigation Workspace",
    description:
      "Give analysts a shared place to inspect timelines, review evidence chains, visualize relationships, collaborate, and export audit-ready findings.",
  },
  {
    title: "Explainable Risk Scoring",
    description:
      "Surface why a signal matters with traceable contributing factors instead of a black-box alert that leaves teams guessing.",
  },
];

const useCases = [
  {
    title: "HR & Recognition Integrity",
    signals: ["Coordinated nomination rings", "Favoritism patterns", "Duplicate narratives", "Unusual approval chains"],
  },
  {
    title: "Procurement Integrity",
    signals: ["Suspicious vendor relationships", "Duplicate invoices", "Approval bypassing", "Procurement collusion"],
  },
  {
    title: "Insider Risk Detection",
    signals: ["Unusual data access", "Privilege misuse", "After-hours activity", "Policy circumvention"],
  },
  {
    title: "Compliance & Governance",
    signals: ["Audit readiness", "Segregation-of-duties analysis", "Operational compliance", "Evidence retention"],
  },
];

const modules = [
  "Integrity Sentinel Core",
  "Sentinel AI Investigator",
  "Sentinel Graph",
  "Sentinel HR Integrity",
  "Sentinel Procurement",
  "Sentinel Insider Risk",
  "Sentinel Compliance",
  "Sentinel Audit Hub",
];

const architecture = [
  { layer: "Frontend", tools: "React, Vite, TypeScript" },
  { layer: "API & Services", tools: "FastAPI, Python, microservices" },
  { layer: "AI & Analytics", tools: "LLM agents, graph analytics, behavioral modeling, anomaly detection" },
  { layer: "Data & Storage", tools: "Azure SQL, Cosmos DB, Neo4j, Blob Storage" },
  { layer: "Security & Identity", tools: "Microsoft Entra ID, RBAC, audit logging, tenant isolation" },
  { layer: "Observability", tools: "OpenTelemetry, Azure Monitor, Application Insights" },
];

export default function IntegritySentinelPage() {
  return (
    <PageLayout>
      <section className="overflow-hidden bg-[#0f0d18] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1fr_0.95fr] lg:px-10 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              Product vision · Enterprise integrity intelligence
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Integrity Sentinel
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/72">
              AI-powered operational trust intelligence for detecting fraud, collusion, abuse,
              insider risk, and workflow anomalies before they become systemic failures.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href={CONTACT_HREF}
                className="inline-flex items-center justify-center rounded-md bg-teal-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-teal-300"
              >
                Discuss the platform
              </a>
              <a
                href="#capabilities"
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-teal-300 hover:text-teal-300"
              >
                Explore capabilities
              </a>
            </div>
          </div>

          <IntegrityConsole />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Strategic positioning</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              Not a SIEM. Not a dashboard. An integrity intelligence system.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-slate-300">
            <p>
              Traditional BI systems surface metrics. Integrity Sentinel is designed to surface
              relationships, intent, behavioral anomalies, and operational risk across the systems
              where work actually happens.
            </p>
            <p>
              The platform concept combines graph analytics, behavioral modeling, explainable AI,
              anomaly detection, relationship intelligence, and investigation workflows into one
              enterprise operating layer.
            </p>
          </div>
        </div>
      </section>

      <section id="capabilities">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Core capabilities</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Built around relationships, behavior, and explainable investigation.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <FeatureCard key={capability.title} title={capability.title} description={capability.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Behavioral risk example</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              Alerts become evidence-backed narratives.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Investigators need more than a flagged record. Integrity Sentinel is envisioned to
              explain the relationships, timing, similarity, and workflow context behind each risk
              signal so teams can decide what deserves action.
            </p>
          </div>

          <div className="rounded-lg border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Case signal</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-100">Approval network anomaly</h3>
              </div>
              <span className="rounded-md bg-rose-400/20 px-3 py-2 text-sm font-bold text-rose-300">High</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {signalStats.map((stat) => (
                <div key={stat.label} className="rounded-md bg-[#0a0916] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-100">{stat.value}</p>
                </div>
              ))}
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <EvidenceItem text="Semantic similarity detected across prior submissions" />
              <EvidenceItem text="Shared approval network appears in multiple unrelated requests" />
              <EvidenceItem text="Elevated after-hours activity and unusual submission velocity" />
              <EvidenceItem text="Cross-department coordination deviates from the baseline" />
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Use cases</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            One platform pattern, multiple integrity domains.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {useCases.map((useCase) => (
              <UseCaseCard key={useCase.title} title={useCase.title} signals={useCase.signals} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Product modules</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              A modular path from concept to enterprise SaaS.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Integrity Sentinel is currently in strategic concept and architecture development,
              with modules shaped around realistic implementation pathways and enterprise controls.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <div key={module} className="rounded-md border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 px-4 py-3 text-sm font-semibold text-slate-200">
                {module}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Reference architecture</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            Cloud-native, explainable, auditable, and tenant-aware by design.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {architecture.map((item) => (
              <div key={item.layer} className="rounded-lg border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 p-5">
                <h3 className="text-sm font-bold text-slate-100">{item.layer}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.tools}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Product status</p>
            <h2 className="mt-3 text-2xl font-bold md:text-3xl">Strategic concept and architecture development.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
              Integrity Sentinel is presented as a platform vision and conceptual SaaS offering. No
              fabricated customer claims, fictional deployments, or invented performance metrics.
            </p>
          </div>
          <a
            href={CONTACT_HREF}
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:bg-teal-300"
          >
            Start a discussion
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function IntegrityConsole() {
  return (
    <div className="relative rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30">
      <div className="relative overflow-hidden rounded-md border border-white/10 bg-[#151321]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-300" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Integrity graph</p>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_0.9fr]">
          <div className="min-h-[22rem] rounded-md border border-white/10 bg-[#0f0d18] p-5">
            <div className="relative h-full min-h-[19rem]">
              <GraphNode className="left-[8%] top-[8%]" label="Employee" tone="teal" />
              <GraphNode className="right-[8%] top-[15%]" label="Vendor" tone="amber" />
              <GraphNode className="left-[35%] top-[42%]" label="Approval" tone="rose" large />
              <GraphNode className="bottom-[10%] left-[10%]" label="Device" tone="slate" />
              <GraphNode className="bottom-[14%] right-[10%]" label="Invoice" tone="indigo" />
              <span className="absolute left-[23%] top-[24%] h-px w-[38%] rotate-[15deg] bg-white/20" />
              <span className="absolute left-[28%] top-[57%] h-px w-[33%] -rotate-[32deg] bg-white/20" />
              <span className="absolute right-[23%] top-[39%] h-px w-[30%] rotate-[135deg] bg-white/20" />
              <span className="absolute bottom-[30%] right-[24%] h-px w-[30%] rotate-[28deg] bg-white/20" />
            </div>
          </div>

          <div className="space-y-3">
            <ConsolePanel title="Anomaly summary" value="Shared approver and vendor cluster with unusual timing." />
            <ConsolePanel title="AI investigator" value="Likely review path: compare prior approvals, inspect semantic overlap, verify vendor master changes." />
            <ConsolePanel title="Evidence export" value="Timeline, entities, relationship map, contributing factors." />
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphNode({
  label,
  tone,
  className,
  large = false,
}: {
  label: string;
  tone: "teal" | "amber" | "rose" | "slate" | "indigo";
  className: string;
  large?: boolean;
}) {
  const toneClass = {
    teal: "border-teal-300/40 bg-teal-300/15 text-teal-100",
    amber: "border-amber-300/40 bg-amber-300/15 text-amber-100",
    rose: "border-rose-300/40 bg-rose-300/15 text-rose-100",
    slate: "border-slate-300/30 bg-slate-300/10 text-slate-100",
    indigo: "border-indigo-300/40 bg-indigo-300/15 text-indigo-100",
  }[tone];

  return (
    <div
      className={`absolute z-10 flex items-center justify-center rounded-full border text-center text-[11px] font-bold uppercase tracking-wider ${toneClass} ${
        large ? "h-24 w-24" : "h-20 w-20"
      } ${className}`}
    >
      {label}
    </div>
  );
}

function ConsolePanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/72">{value}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function EvidenceItem({ text }: { text: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-teal-500" />
      <span>{text}</span>
    </li>
  );
}

function UseCaseCard({ title, signals }: { title: string; signals: string[] }) {
  return (
    <div className="rounded-lg border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-lg font-bold text-slate-100">{title}</h3>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {signals.map((signal) => (
          <span key={signal} className="rounded-md bg-[#0a0916] px-3 py-2 text-sm font-semibold text-slate-200">
            {signal}
          </span>
        ))}
      </div>
    </div>
  );
}
