import { useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Read tier + type pre-selected from query string (set by pricing page CTA links)
function getQueryParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-200">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Match the site's input style exactly (same as ContactPage)
const inputCls =
  "w-full rounded-md border border-white/20 bg-[#0f0d18] px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50";

// ── Step 1: Account ───────────────────────────────────────────────────────────

interface Step1Data {
  full_name: string;
  email: string;
  password: string;
  password_confirm: string;
}

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: Step1Data;
  onChange: (d: Partial<Step1Data>) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Step1Data>>({});

  const validate = () => {
    const e: Partial<Step1Data> = {};
    if (!data.full_name.trim()) e.full_name = "Name is required.";
    if (!data.email.trim() || !/\S+@\S+\.\S+/.test(data.email))
      e.email = "A valid email is required.";
    if (data.password.length < 8) e.password = "At least 8 characters.";
    if (data.password !== data.password_confirm)
      e.password_confirm = "Passwords do not match.";
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext();
  };

  return (
    <div className="space-y-5">
      <Field label="Full name" id="full_name">
        <input
          id="full_name"
          type="text"
          autoComplete="name"
          value={data.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          placeholder="Jane Smith"
          className={inputCls}
        />
        {errors.full_name && <p className="mt-1 text-xs text-red-400">{errors.full_name}</p>}
      </Field>

      <Field label="Work email" id="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="jane@company.com"
          className={inputCls}
        />
        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
      </Field>

      <Field label="Password" id="password" hint="Minimum 8 characters.">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={data.password}
          onChange={(e) => onChange({ password: e.target.value })}
          className={inputCls}
        />
        {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
      </Field>

      <Field label="Confirm password" id="password_confirm">
        <input
          id="password_confirm"
          type="password"
          autoComplete="new-password"
          value={data.password_confirm}
          onChange={(e) => onChange({ password_confirm: e.target.value })}
          className={inputCls}
        />
        {errors.password_confirm && (
          <p className="mt-1 text-xs text-red-400">{errors.password_confirm}</p>
        )}
      </Field>

      <button
        type="button"
        onClick={handleNext}
        className="mt-2 w-full rounded-md bg-violet-500 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-[#0f0d18] transition hover:bg-violet-400"
      >
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: Org & usage ───────────────────────────────────────────────────────

interface Step2Data {
  org_name: string;
  industry: string;
  user_count: string;
  use_case: string;
  tier_interest: string;
  engagement_type: string;
}

const INDUSTRIES = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Education",
  "Retail & E-commerce",
  "Manufacturing",
  "Government",
  "Non-profit",
  "Other",
];

function Step2({
  data,
  onChange,
  onNext,
  onBack,
  submitting,
}: {
  data: Step2Data;
  onChange: (d: Partial<Step2Data>) => void;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Step2Data, string>>>({});

  const validate = () => {
    const e: Partial<Record<keyof Step2Data, string>> = {};
    if (!data.org_name.trim()) e.org_name = "Organization name is required.";
    const count = parseInt(data.user_count, 10);
    if (!data.user_count || isNaN(count) || count < 1)
      e.user_count = "Enter the estimated number of users (≥ 1).";
    if (!data.tier_interest) e.tier_interest = "Please select a tier.";
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext();
  };

  return (
    <div className="space-y-5">
      <Field label="Organization name" id="org_name">
        <input
          id="org_name"
          type="text"
          value={data.org_name}
          onChange={(e) => onChange({ org_name: e.target.value })}
          placeholder="Acme Corp"
          className={inputCls}
        />
        {errors.org_name && <p className="mt-1 text-xs text-red-400">{errors.org_name}</p>}
      </Field>

      <Field label="Industry" id="industry">
        <select
          id="industry"
          value={data.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
          className={inputCls}
        >
          <option value="">Select industry…</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </Field>

      <Field label="Estimated number of employees" id="user_count">
        <input
          id="user_count"
          type="number"
          min={1}
          value={data.user_count}
          onChange={(e) => onChange({ user_count: e.target.value })}
          placeholder="e.g. 200"
          className={inputCls}
        />
        {errors.user_count && <p className="mt-1 text-xs text-red-400">{errors.user_count}</p>}
      </Field>

      <Field label="Tier interest" id="tier_interest">
        <select
          id="tier_interest"
          value={data.tier_interest}
          onChange={(e) => onChange({ tier_interest: e.target.value })}
          className={inputCls}
        >
          <option value="">Select a tier…</option>
          <option value="Starter">Starter — up to 50 users</option>
          <option value="Professional">Professional — 50–500 users</option>
          <option value="Enterprise">Enterprise — 500+ users</option>
        </select>
        {errors.tier_interest && (
          <p className="mt-1 text-xs text-red-400">{errors.tier_interest}</p>
        )}
      </Field>

      <Field
        label="How do you plan to use Award Nomination? (optional)"
        id="use_case"
        hint="A short description helps us prepare the right engagement letter."
      >
        <textarea
          id="use_case"
          rows={4}
          value={data.use_case}
          onChange={(e) => onChange({ use_case: e.target.value })}
          placeholder="e.g. We want to replace our manual peer-recognition process with an automated, analytics-driven system…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="w-1/3 rounded-md border border-white/20 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 rounded-md bg-violet-500 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-[#0f0d18] transition hover:bg-violet-400 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit request →"}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Confirmation ──────────────────────────────────────────────────────

function Step3({ orgName }: { orgName: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15">
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-violet-400">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="mt-6 font-playfair text-2xl font-bold text-slate-100">
        You're on the list, {orgName}.
      </h2>
      <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
        We've received your engagement request and will review it shortly. Expect to hear from us
        within one business day with next steps and an engagement letter.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <a
          href="/"
          className="rounded-md border border-white/20 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Back to home
        </a>
        <a
          href="/contact"
          className="rounded-md bg-violet-500 px-6 py-2.5 text-sm font-bold text-[#0f0d18] transition hover:bg-violet-400"
        >
          Contact us directly
        </a>
      </div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Create account", "Organization", "Confirmed"];
  return (
    <ol className="flex items-center">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                  done
                    ? "bg-violet-500 text-[#0f0d18]"
                    : active
                    ? "border-2 border-violet-400 text-violet-400"
                    : "border border-white/20 text-slate-600"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 14 14" fill="none" className="h-4 w-4">
                    <path
                      d="M2.5 7.5l3 3 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`mt-1.5 hidden text-[11px] font-semibold sm:block ${
                  active ? "text-violet-400" : done ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 mb-5 h-px w-12 sm:w-20 ${
                  done ? "bg-violet-500" : "bg-white/10"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewEngagementPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [step1, setStep1] = useState<Step1Data>({
    full_name: "",
    email: "",
    password: "",
    password_confirm: "",
  });

  const [step2, setStep2] = useState<Step2Data>({
    org_name: "",
    industry: "",
    user_count: "",
    use_case: "",
    tier_interest: getQueryParam("tier"),
    engagement_type: getQueryParam("type") || "Award Nomination",
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/api/accounts/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name:       step1.full_name,
          email:           step1.email,
          password:        step1.password,
          org_name:        step2.org_name,
          industry:        step2.industry,
          user_count:      parseInt(step2.user_count, 10),
          use_case:        step2.use_case,
          tier_interest:   step2.tier_interest,
          engagement_type: step2.engagement_type,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
      }
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const heroProps: Record<number, { eyebrow: string; title: string; description: string }> = {
    1: {
      eyebrow: "Get started · Step 1 of 2",
      title: "Create your account.",
      description: "A free account lets us tie your engagement request to your organization and keep you updated on next steps.",
    },
    2: {
      eyebrow: "Get started · Step 2 of 2",
      title: "Tell us about your organization.",
      description: "A few details help us prepare the right engagement letter and reach out with relevant context.",
    },
    3: {
      eyebrow: "Request submitted",
      title: "We'll be in touch.",
      description: "Your request is in our queue. We review every submission and reply within one business day.",
    },
  };

  const hero = heroProps[step] ?? heroProps[1];

  return (
    <PageLayout>
      <PageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        description={hero.description}
      />

      <section className="border-t border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-3">

          {/* Left: engagement badge only */}
          <div className="lg:col-span-1">
            {step < 3 && step2.engagement_type && (
              <div className="rounded-md border border-white/10 bg-[#0f0d18] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Selected
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-200">
                  {step2.engagement_type}
                </p>
                {step2.tier_interest && (
                  <p className="mt-1 text-sm text-violet-400">{step2.tier_interest} tier</p>
                )}
                <a
                  href="/pricing/award-nomination"
                  className="mt-3 block text-xs text-slate-500 transition hover:text-violet-400"
                >
                  ← Change plan
                </a>
              </div>
            )}
          </div>

          {/* Right: step indicator card + form */}
          <div className="lg:col-span-2">

            {/* Step indicator — in its own card, above the form fields */}
            {step < 3 && (
              <div className="mb-8 rounded-md border border-white/10 bg-[#0f0d18] px-6 py-5">
                <StepIndicator current={step} />
              </div>
            )}

            {step === 1 && (
              <Step1
                data={step1}
                onChange={(d) => setStep1((prev) => ({ ...prev, ...d }))}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <>
                <Step2
                  data={step2}
                  onChange={(d) => setStep2((prev) => ({ ...prev, ...d }))}
                  onNext={handleSubmit}
                  onBack={() => setStep(1)}
                  submitting={submitting}
                />
                {submitError && (
                  <p className="mt-4 text-sm text-red-400">{submitError}</p>
                )}
              </>
            )}

            {step === 3 && <Step3 orgName={step2.org_name} />}
          </div>

        </div>
        </div>
      </section>
    </PageLayout>
  );
}
