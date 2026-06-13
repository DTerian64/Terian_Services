import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

// A "proof" sample drawn from our flagship build — the Award Nomination System.
// Each maps a capability claim on this page to a tangible artifact from that product.
type Sample = {
  src: string;
  eyebrow: string;
  caption: string;
};

export default function AIAnalyticsPage() {
  const [sample, setSample] = useState<Sample | null>(null);

  return (
    <PageLayout>
      {sample && <SampleModal sample={sample} onClose={() => setSample(null)} />}
      <PageHero
        eyebrow="Service"
        title="AI Analytics"
        description="Forecasts, classifications, anomaly detection, and embedding-based search built on your data — productionized, monitored, and explainable."
        primaryCta={{ label: "Talk to engineering", href: "/contact" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Capabilities</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          The shape of work we deliver.
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="Forecasting" description="Demand, headcount, spend, and capacity planning with quantified uncertainty bands." />
          <Card
            title="Classification"
            description="Risk scoring, churn propensity, ticket triage — calibrated, monitored, with explanation layers."
            onSample={() =>
              setSample({
                src: "/fraud_feature_importance.png",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Feature importance from the shipped per-tenant Random Forest — collusion and concentration signals dominate, so every fraud score is attributable to inputs like these.",
              })
            }
          />
          <Card
            title="Anomaly detection"
            description="Time-series, multivariate, and embedding-based outlier detection on operational data."
            onSample={() =>
              setSample({
                src: "/award_anomaly_super_nominator.png",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Behavioural outlier detection — a single user's nomination volume flagged against the tenant's statistical baseline (mean 5.0, threshold 14.5).",
              })
            }
          />
          <Card
            title="Graph & relationship analytics"
            description="Entity-and-relationship graphs over the people and approvals in your workflows — surfacing collusion rings, reciprocal cycles, approver affinity, and volume outliers that row-by-row metrics miss."
            onSample={() =>
              setSample({
                src: "/award_graph_nomination_ring.png",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Relationship-graph analysis — a directed cycle of mutual nominations (a collusion ring) traced across four users and their approvers.",
              })
            }
          />
          <Card
            title="NLP on unstructured text"
            description="Semantic analysis of free-text submissions — category-alignment scoring, duplicate and copied-content detection, and policy-aware classification of unstructured descriptions."
            onSample={() =>
              setSample({
                src: "/award_category_mismatch.png",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Policy-aware text analysis — a nomination auto-returned because its description scored only 0.12 semantic similarity to the award category (minimum 0.12).",
              })
            }
          />
          <Card
            title="Embedding-based search"
            description="Embedding-based similarity and nearest-neighbour retrieval over historical records — surfacing duplicates, near-matches, and copied content in real time."
            onSample={() =>
              setSample({
                src: "/award_embedding_pair_history.png",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Nearest-neighbour retrieval — a new submission matched to its most-similar prior nomination (0.94 similarity) with the full pair history surfaced for review.",
              })
            }
          />
          <Card
            title="Generative AI integration"
            description="LLM-powered features in line-of-business apps with retrieval, evals, and guardrails."
            sampleLabel="View architecture →"
            onSample={() =>
              setSample({
                src: "/ask_ai_orchestration_flow.svg",
                eyebrow: "Sample · Award Nomination System",
                caption:
                  "Analytics Q&A agent — an LLM tool-calling loop wired to schema, export, fraud, and graph skills.",
              })
            }
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Tech stack</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            The Microsoft data and AI stack — plus the right open tools.
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Pill label="Azure ML / Azure AI Foundry" />
            <Pill label="Azure OpenAI" />
            <Pill label="Microsoft Fabric / Synapse" />
            <Pill label="Databricks" />
            <Pill label="Hugging Face" />
            <Pill label="LangChain / LlamaIndex" />
            <Pill label="MLflow" />
            <Pill label="dbt + Snowflake (when applicable)" />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
            Integrity, provenance, and confidentiality
          </p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            AI you can trace, defend, and explain.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            "The model said so" is not an answer your auditor accepts. We build AI systems where
            every prediction can be traced back to the data version and model version that produced
            it, every input is governed by least-privilege access, and your data is never used to
            train models that touch other tenants.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card
              title="Data lineage"
              description="Versioned datasets, feature pipelines, and model artifacts wired through MLflow / Azure ML. Every prediction is reproducible from inputs and weights."
              onSample={() =>
                setSample({
                  src: "/award_nomination_architecture.svg",
                  eyebrow: "Sample · Award Nomination System",
                  caption:
                    "Production architecture — per-tenant models versioned in Blob Storage, retrained and re-streamed without redeploy.",
                })
              }
            />
            <Card
              title="Decision provenance"
              description="Each model output is logged with its model version, input snapshot, and explanation layer (SHAP, integrated gradients, or token-level attribution for LLMs)."
              onSample={() =>
                setSample({
                  src: "/awards-nomination-log-analytics.png",
                  eyebrow: "Sample · Award Nomination System",
                  caption:
                    "Audit trail — every nomination decision traced through its review and approval chain, exportable for compliance.",
                })
              }
            />
            <Card
              title="Confidentiality of inference"
              description="Your prompts, embeddings, and inputs are never used to train cross-tenant models. Customer-managed keys and private endpoints supported on request."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Engagement model</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Start with the metric. End with the proof.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Step number="1" title="Frame" description="One-week framing sprint: target metric, baseline, success criteria, data access plan." />
          <Step number="2" title="Build" description="Fixed-price pilot. Production-shaped pipelines, evals, monitoring — no throwaway notebooks." />
          <Step number="3" title="Operate" description="Hand-off with retraining cadence, drift monitoring, runbooks. Optional ongoing ownership." />
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Bring us the metric.</h2>
            <p className="mt-2 text-white/70">We'll come back with what's testable in 30 days.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
          >
            Start a conversation →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Card({
  title,
  description,
  onSample,
  sampleLabel = "View sample →",
}: {
  title: string;
  description: string;
  onSample?: () => void;
  sampleLabel?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
      {onSample && (
        <button
          type="button"
          onClick={onSample}
          className="mt-3 text-xs font-semibold text-teal-400 transition hover:text-teal-300"
        >
          {sampleLabel}
        </button>
      )}
    </div>
  );
}

function SampleModal({ sample, onClose }: { sample: Sample; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-white/10 bg-[#0f0d18] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">{sample.eyebrow}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">{sample.caption}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sample"
            className="ml-4 flex-none rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto p-6">
          <img src={sample.src} alt={sample.caption} className="mx-auto w-full rounded-lg bg-white" />
        </div>
      </div>
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
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 p-6">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
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
