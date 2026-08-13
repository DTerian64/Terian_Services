import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import JobApplicationModal from "../components/JobApplicationModal";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type JobSummary = {
  id: string;
  title: string;
  tagline: string;
  location: string;
  type: string;
  posted_at: string;
};

export default function JobsPage() {
  const [jobs,    setJobs]    = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [applyJob, setApplyJob] = useState<JobSummary | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/jobs`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<JobSummary[]>;
      })
      .then(setJobs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      <PageHero
        eyebrow="Careers"
        title="Join the team behind Terianix."
        description="Terianix is enterprise SaaS built by Terian Services. We work on hard engineering problems at the intersection of AI, enterprise software, and data — and we hire the people who built and shipped the things, not just managed them."
      />

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        {loading && (
          <p className="text-center text-slate-400">Loading open positions…</p>
        )}

        {error && (
          <p className="text-center text-slate-400">
            Could not load positions. Please try again or email{" "}
            <a href="mailto:jobs@terian-services.com" className="text-violet-400 hover:text-violet-300">
              jobs@terian-services.com
            </a>
            .
          </p>
        )}

        {!loading && !error && jobs.length === 0 && (
          <p className="text-center text-slate-400">
            No open positions right now — check back soon.
          </p>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="space-y-5">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onApply={() => setApplyJob(job)}
              />
            ))}
          </div>
        )}
      </section>

      {applyJob && (
        <JobApplicationModal
          jobId={applyJob.id}
          jobTitle={applyJob.title}
          jobTagline={applyJob.tagline}
          onClose={() => setApplyJob(null)}
        />
      )}
    </PageLayout>
  );
}

function JobCard({ job, onApply }: { job: JobSummary; onApply: () => void }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0a0916] p-6 transition hover:border-violet-400">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-playfair text-lg font-bold leading-snug text-slate-100">
            {job.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{job.tagline}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag>{job.location}</Tag>
            <Tag>{job.type}</Tag>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={onApply}
            className="whitespace-nowrap rounded-md bg-violet-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-violet-400"
          >
            Apply
          </button>
          <a
            href={`/jobs/${job.id}`}
            className="whitespace-nowrap text-center text-sm font-semibold text-violet-400 transition hover:text-violet-300"
          >
            View details →
          </a>
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-400">
      {children}
    </span>
  );
}
