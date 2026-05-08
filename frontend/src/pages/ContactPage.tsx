import { useMemo, useState } from "react";
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

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [inquiry, setInquiry] = useState<InquiryType>("Services consultation");
  const [message, setMessage] = useState("");

  const mailtoHref = useMemo(() => {
    const subject = `[${inquiry}] Inbound from ${name || "website"}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Inquiry type: ${inquiry}`,
      "",
      "Message:",
      message,
    ].join("\n");
    return `mailto:support@terian-services.com?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [name, email, company, inquiry, message]);

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
            <h2 className="text-lg font-bold text-slate-950">Direct contacts</h2>
            <ContactLink label="Sales & demos" email="sales@terian-services.com" />
            <ContactLink label="Support" email="support@terian-services.com" />
            <ContactLink label="Security" email="security@terian-services.com" />

            <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
              <p className="font-semibold text-slate-950">Where we are</p>
              <p className="mt-2">
                Hosted in Microsoft Azure, primary region <span className="font-semibold">West US 2</span>.
              </p>
              <p className="mt-2">
                For services engagements we typically work inside your Azure tenant, under MSA & DPA.
              </p>
            </div>
          </div>

          <form
            action={mailtoHref}
            method="post"
            encType="text/plain"
            className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-950">Send us a message</p>
            <p className="mt-1 text-xs text-slate-500">
              Submitting this form opens your email client with a pre-filled message — your data
              never leaves your device unless you send it.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </Field>
              <Field label="Work email" required>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </Field>
              <Field label="Inquiry type" required>
                <select
                  value={inquiry}
                  onChange={(e) => setInquiry(e.target.value as InquiryType)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {INQUIRY_TYPES.map((type) => (
                    <option key={type} value={type}>
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-teal-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-teal-600"
              >
                Send message →
              </button>
              <span className="text-xs text-slate-500">
                Or email{" "}
                <a className="font-semibold text-teal-700 hover:text-teal-800" href="mailto:support@terian-services.com">
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
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ContactLink({ label, email }: { label: string; email: string }) {
  return (
    <div className="mt-3 first:mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <a className="text-sm font-semibold text-teal-700 hover:text-teal-800" href={`mailto:${email}`}>
        {email}
      </a>
    </div>
  );
}
