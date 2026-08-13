import { useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import JobApplicationModal from "../components/JobApplicationModal";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Section = {
  heading: string;
  body: string;
  bullets: string[];
};

type Job = {
  id: string;
  title: string;
  tagline: string;
  location: string;
  type: string;
  posted_at: string;
  sections: Section[];
};

function formatPostedDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type Props = { jobId: string };

export default function JobDetailPage({ jobId }: Props) {
  const [job,     setJob]     = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showFloatingApply, setShowStickyBar] = useState(false);
  const actionRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/jobs/${jobId}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Job>;
      })
      .then(setJob)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    const node = actionRowRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: "-88px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [job]);

  if (loading) {
    return (
      <PageLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-slate-400">Loading…</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !job) {
    return (
      <PageLayout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold text-slate-300">
            {error === "not_found"
              ? "This position is no longer available."
              : "Could not load this position. Please try again."}
          </p>
          <a href="/jobs" className="text-sm font-semibold text-violet-400 hover:text-violet-300">
            ← Back to all positions
          </a>
        </div>
      </PageLayout>
    );
  }

  const postedLabel = formatPostedDate(job.posted_at);

  return (
    <PageLayout>
      {/* Floating apply button — appears once the primary action row scrolls out of view */}
      <button
        type="button"
        onClick={() => setShowApply(true)}
        className={`fixed right-6 top-[6.6rem] z-40 rounded-md bg-violet-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-black/20 transition-all duration-200 hover:bg-violet-400 ${
          showFloatingApply ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        Apply Now
      </button>

      {/* Sections */}
      <section className="mx-auto max-w-5xl px-6 pt-10 pb-12 lg:px-10 lg:pt-14">
        <div className="rounded-2xl bg-white p-8 font-jobsans text-black shadow-xl shadow-black/20 sm:p-10 lg:p-12">
          <a href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-violet-600">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
              <path d="M12.5 5 7.5 10 12.5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All positions
          </a>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Open Position</p>
          <h1 className="mt-3 font-playfair text-3xl font-bold leading-tight tracking-tight text-black md:text-4xl">
            {job.title}
          </h1>
          {job.tagline && (
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{job.tagline}</p>
          )}

          <div ref={actionRowRef} className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-8">
            <div className="flex flex-wrap items-center gap-3">
              <Tag>{job.location}</Tag>
              <Tag>{job.type}</Tag>
              {postedLabel && <span className="text-xs font-medium text-slate-500">Posted {postedLabel}</span>}
            </div>
            <button
              type="button"
              onClick={() => setShowApply(true)}
              className="rounded-md bg-violet-500 px-5 py-2 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-violet-400"
            >
              Apply Now
            </button>
          </div>

          <div className="mt-10">
            {job.sections.map((section, i) => (
              <JobSection key={section.heading} section={section} isFirst={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/15 bg-[#0f0d18]">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 lg:flex-row lg:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 md:text-3xl">Ready to apply?</h2>
            <p className="mt-2 text-white/70">Submit your application and we'll be in touch if there's a fit.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowApply(true)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-violet-500 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-violet-400"
          >
            Apply Now
          </button>
        </div>
      </section>

      {showApply && (
        <JobApplicationModal
          jobId={job.id}
          jobTitle={job.title}
          jobTagline={job.tagline}
          onClose={() => setShowApply(false)}
        />
      )}
    </PageLayout>
  );
}

function JobSection({ section, isFirst }: { section: Section; isFirst: boolean }) {
  const paragraphs = section.body.split(/\n\n+/).filter(Boolean);

  return (
    <div className={isFirst ? "" : "mt-10 border-t border-slate-100 pt-10"}>
      <h2 className="flex items-center gap-3 font-playfair text-2xl font-bold text-black">
        <span className="h-5 w-1 shrink-0 rounded-full bg-violet-500" />
        {section.heading}
      </h2>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="mt-4 max-w-[68ch] text-base leading-[1.7] text-slate-700">
          {paragraph}
        </p>
      ))}
      {section.bullets.length > 0 && (
        <ul className="mt-4 max-w-[68ch] space-y-2.5">
          {section.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-3 text-base leading-[1.7] text-slate-700">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}
