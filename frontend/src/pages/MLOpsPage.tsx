import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function MLOpsPage() {
  return (
    <PageLayout>
      <PageHero
        eyebrow="Service · Now booking pilots"
        title="MLOps & Model Governance"
        description="The infrastructure that keeps models trustworthy in production — registry, drift monitoring, evaluation harnesses, and responsible-AI review."
        primaryCta={{ label: "Book a pilot conversation", href: "/contact" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Why MLOps</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Most "AI in production" is one failed retrain away from off.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Models drift. Inputs change. Evaluation criteria shift as the business learns. MLOps is
          the boring, durable infrastructure that turns "we trained a model once" into "we run a
          family of models with confidence."
        </p>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Capabilities</p>
          <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
            What we set up.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Model registry" description="Versioned models, lineage, and stage promotion (dev → staging → prod) with approvals." />
            <Card title="Drift monitoring" description="Input distribution drift, prediction drift, and concept drift with alerting and auto-retraining triggers." />
            <Card title="Evaluation harnesses" description="Repeatable eval pipelines for offline metrics, online A/B tests, and red-team prompts (for LLMs)." />
            <Card title="Responsible-AI review" description="Bias audits, explanation layers, model cards, and a documented risk register before launch." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Reference architecture</p>
        <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
          Familiar tools, sensibly wired.
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pill label="Azure ML / Azure AI Foundry" />
          <Pill label="MLflow" />
          <Pill label="Evidently AI" />
          <Pill label="Great Expectations" />
          <Pill label="GitHub Actions / Azure DevOps" />
          <Pill label="Microsoft Fabric / Synapse" />
          <Pill label="Databricks (when applicable)" />
          <Pill label="Promptfoo / DeepEval (LLMs)" />
        </div>
      </section>

      <section className="bg-[#0f0d18] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Have models in prod?</h2>
            <p className="mt-2 text-white/70">We'll audit the gaps in 2 weeks and propose a 6-week pilot.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-teal-400 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-teal-300"
          >
            Book a pilot →
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-6">
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
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
