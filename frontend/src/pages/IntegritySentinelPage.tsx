import { useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

export default function IntegritySentinelPage() {
  const [email, setEmail] = useState("");
  const subject = "Integrity Sentinel — Pilot interest";
  const body = `Please add me to the Integrity Sentinel pilot waitlist.\n\nEmail: ${email}\n`;
  const mailto = `mailto:sales@terian-services.com?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <PageLayout>
      <PageHero
        eyebrow="Product · Coming Soon"
        title="Integrity Sentinel"
        description="Productized fraud-detection SaaS — multi-tenant, configurable rule engine plus ML models for transactions, vendor master, and expense data. Pilot opening in 2026."
      />

      <section className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">The problem</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Most companies can't afford a custom fraud program.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Bespoke fraud detection works — and we deliver it as a service today. But the same
          patterns repeat across mid-market finance teams: ghost vendors, duplicate payments,
          expense gaming, kickback rings. Integrity Sentinel packages those detections into a SaaS
          you can stand up in days, not months.
        </p>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Planned feature set</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            What's in the v1.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Out-of-the-box detections" description="Vendor collusion, duplicate payments, ghost vendors, expense threshold-tuning, segregation-of-duties violations." />
            <Card title="Configurable rule engine" description="Customize thresholds, exemptions, and approver hierarchies without code." />
            <Card title="ML scoring layer" description="Anomaly scores trained on your historical data, with feedback loop from investigator decisions." />
            <Card title="Investigator workflow" description="Triage queue, case management, evidence capture, and exportable case packets." />
            <Card title="Connectors" description="Workday, Microsoft Dynamics, NetSuite, SAP, plus CSV ingestion for the long tail." />
            <Card title="Audit-ready reporting" description="Detection coverage, case outcomes, and program ROI in formats your audit committee already reads." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Get notified</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            Be first in line for the pilot.
          </h2>
          <p className="mt-3 text-sm leading-7 text-teal-900/80">
            Drop your email — we'll send a single message when the pilot opens, no marketing list.
          </p>

          <form action={mailto} method="post" encType="text/plain" className="mt-6 flex flex-wrap justify-center gap-3">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full max-w-xs rounded-md border border-teal-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-teal-500 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-teal-600"
            >
              Notify me →
            </button>
          </form>
          <p className="mt-3 text-xs text-teal-900/70">
            Submitting opens your email client with a pre-filled message — your data never leaves your device unless you send it.
          </p>
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
