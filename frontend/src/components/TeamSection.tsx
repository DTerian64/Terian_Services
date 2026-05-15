/**
 * TeamSection.tsx
 * ───────────────
 * Fetches /api/team and renders a grid of team member cards.
 * Each card shows photo (with initials fallback), name, title, bio,
 * and an optional LinkedIn link.
 *
 * Data lives in Cosmos DB `employees` container — add/edit documents there.
 */

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamMember = {
  id: string;
  name: string;
  title: string;
  bio: string;
  photo_url: string;
  linkedin_url?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, photo_url }: { name: string; photo_url: string }) {
  const [failed, setFailed] = useState(!photo_url);

  if (!failed && photo_url) {
    return (
      <img
        src={photo_url}
        alt={name}
        onError={() => setFailed(true)}
        className="h-20 w-20 rounded-full object-cover ring-2 ring-teal-400/30"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/20 ring-2 ring-teal-400/30">
      <span className="text-xl font-bold text-teal-300">{initials(name)}</span>
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400 flex gap-6 items-start">
      <div className="shrink-0">
        <Avatar name={member.name} photo_url={member.photo_url} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-slate-100">{member.name}</h3>
        <p className="text-sm font-medium text-teal-400">{member.title}</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">{member.bio}</p>
        {member.linkedin_url && (
          <a
            href={member.linkedin_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
          >
            LinkedIn →
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 animate-pulse flex gap-6 items-start">
      <div className="shrink-0 h-20 w-20 rounded-full bg-white/10" />
      <div className="flex-1 space-y-3 pt-1">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="space-y-2 pt-1">
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-5/6 rounded bg-white/10" />
          <div className="h-3 w-4/6 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamSection() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/team`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TeamMember[]>;
      })
      .then(setMembers)
      .catch((err) => {
        console.warn("TeamSection: could not load team", err);
        setError(true);
      });
  }, []);

  const isLoading = !members && !error;

  return (
    <section className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Our Team &amp; Partners</p>

      <div className="mt-6 grid gap-6">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <p className="col-span-3 text-sm text-slate-500">Team information is temporarily unavailable.</p>
        ) : (
          members!.map((m) => <MemberCard key={m.id} member={m} />)
        )}
      </div>
    </section>
  );
}
