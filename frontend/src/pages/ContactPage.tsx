import { useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const INQUIRY_TYPES = [
  "Product demo",
  "Services consultation",
  "Partnership",
  "Press",
  "Other",
] as const;

type InquiryType = (typeof INQUIRY_TYPES)[number];
type Status = "idle" | "submitting" | "success" | "error";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function ContactPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [company, setCompany] = useState("");
  const [inquiry, setInquiry] = useState<InquiryType>("Services consultation");
  const [message, setMessage] = useState("");
  const [status, setStatus]   = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, company, inquiry, message }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-[#0f0d18] px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50";

  return (
    <PageLayout>
      <PageHero
        eyebrow="Contact"
        title="Tell us what you're working on."
        description="Whether you're evaluating a product, scoping a services engagement, or just have a question — we read every message and reply within one business day."
      />

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="text-lg font-bold text-slate-100">Direct contacts</h2>
            <ContactLink label="Sales & demos" email="sales@terian-services.com" />
            <ContactLink label="Support"       email="support@terian-services.com" />
            <ContactLink label="Security"      email="security@terian-services.com" />

            <div className="mt-10 rounded-xl border-2 border-white/10 bg-[#0a0916] transition hover:border-teal-400 p-5 text-sm leading-7 text-slate-300">
              <p className="font-semibold text-slate-100">Where we are</p>
              <p className="mt-2">
                Hosted in Microsoft Azure, primary region{" "}
                <span className="font-semibold">West US 2</span>.
              </p>
              <p className="mt-2">
                For services engagements we typically work inside your Azure
                tenant, under MSA &amp; DPA.
              </p>
            </div>
          </div>

          {/* ── Form ── */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 rounded-xl border-2 border-white/10 bg-[#0f0d18] transition hover:border-teal-400 p-8"
          >
            <p className="text-sm font-semibold text-slate-100">Send us a message</p>
            <p className="mt-1 text-xs text-slate-400">
              We'll get back to you within one business day.
            </p>

            {/* Success banner */}
            {status === "success" && (
              <div className="mt-4 rounded-lg border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
                Message sent — we'll be in touch shortly.
              </div>
            )}

            {/* Error banner */}
            {status === "error" && (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                Something went wrong. Please try again or email{" "}
                <a
                  href="mailto:support@terian-services.com"
                  className="font-semibold underline underline-offset-2"
                >
                  support@terian-services.com
                </a>{" "}
                directly.
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "submitting" || status === "success"}
                  className={inputClass}
                />
              </Field>
              <Field label="Work email" required>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "submitting" || status === "success"}
                  className={inputClass}
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={status === "submitting" || status === "success"}
                  className={inputClass}
                />
              </Field>
              <Field label="Inquiry type" required>
                <select
                  value={inquiry}
                  onChange={(e) => setInquiry(e.target.value as InquiryType)}
                  disabled={status === "submitting" || status === "success"}
                  className={inputClass}
                >
                  {INQUIRY_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-zinc-900">
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Message" required>
                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={status === "submitting" || status === "success"}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={status === "submitting" || status === "success"}
                className="inline-flex items-center justify-center rounded-md bg-teal-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? "Sending…" : "Send message →"}
              </button>
              <span className="text-xs text-slate-400">
                Or email{" "}
                <a
                  className="font-semibold text-teal-400 hover:text-teal-300"
                  href="mailto:support@terian-services.com"
                >
                  support@terian-services.com
                </a>
              </span>
            </div>
          </form>
        </div>
      </section>
    </PageLayout>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ContactLink({ label, email }: { label: string; email: string }) {
  return (
    <div className="mt-3 first:mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <a
        className="text-sm font-semibold text-teal-400 hover:text-teal-300"
        href={`mailto:${email}`}
      >
        {email}
      </a>
    </div>
  );
}
