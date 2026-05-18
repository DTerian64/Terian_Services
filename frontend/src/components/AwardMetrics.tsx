/**
 * AwardMetrics.tsx
 * ────────────────
 * Fetches last-24h metrics from /api/metrics/awards and renders:
 *   • Health at a glance  — 6 KPI cards (requests, failure rate, P95, users,
 *                           page views, nominations)
 *   • Compute & Database  — 4 KPI cards (ACA primary/secondary replicas,
 *                           SQL storage, sessions)
 *   • Hourly chart        — requests + failures per hour (line chart)
 *
 * Fails silently: if the endpoint is unreachable the component renders nothing
 * so the marketing page is never broken by a monitoring outage.
 */

import { useEffect, useState, useCallback } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type HourlyRow = {
  timestamp: string;
  total: number;
  failures: number;
  avg_ms: number;
};

type Summary = {
  total: number;
  failures: number;
  p50_ms: number;
  p95_ms: number;
};

type Health = {
  total: number;
  failures: number;
  p95_ms: number;
  unique_users: number;
  pages_viewed: number;
  nominations: number;
  sessions: number;
};

type Compute = {
  aca_primary: number;
  aca_secondary: number;
  sql_mb: number;
};

type MetricsData = {
  summary: Summary;
  hourly: HourlyRow[];
  health: Health;
  compute: Compute;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function failureRate(h: Health): string {
  if (!h.total) return "—";
  return `${((h.failures / h.total) * 100).toFixed(2)}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6 transition hover:border-teal-400">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-28 rounded-xl border-2 border-white/10 bg-[#0f0d18] animate-pulse" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-10 mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AwardMetrics() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [error, setError] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const openDiagram  = useCallback(() => setShowDiagram(true),  []);
  const closeDiagram = useCallback(() => setShowDiagram(false), []);

  useEffect(() => {
    fetch(`${API_BASE}/api/metrics/awards`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MetricsData>;
      })
      .then(setData)
      .catch((err) => {
        console.warn("AwardMetrics: could not load metrics", err);
        setError(true);
      });
  }, []);

  const isLoading = !data && !error;

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400 flex items-center gap-2">
        Live platform metrics
        <button
          onClick={openDiagram}
          className="normal-case tracking-normal font-medium text-teal-400/70 hover:text-teal-300 underline underline-offset-2 transition"
        >
          (how it works)
        </button>
      </p>
      <h2 className="mt-3 font-playfair text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
        Last 24 hours.
      </h2>
      <p className="mt-3 text-sm text-slate-400">
        Live telemetry from the Award Nomination System sandbox — refreshed every 5 minutes.
      </p>

      {/* ── Health at a glance ── */}
      <SectionLabel>Health at a glance</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : error ? (
          <div className="col-span-3 rounded-xl border-2 border-white/10 bg-[#0f0d18] px-6 py-10 text-center text-sm text-slate-500">
            Metrics are temporarily unavailable — live telemetry refreshes every 5 minutes.
          </div>
        ) : (
          <>
            <KpiCard
              label="Total API requests"
              value={data!.health.total.toLocaleString()}
            />
            <KpiCard
              label="API failure rate"
              value={failureRate(data!.health)}
            />
            <KpiCard
              label="P95 latency"
              value={`${data!.health.p95_ms} ms`}
            />
            <KpiCard
              label="Unique users"
              value={data!.health.unique_users.toLocaleString()}
            />
            <KpiCard
              label="Pages viewed"
              value={data!.health.pages_viewed.toLocaleString()}
            />
            <KpiCard
              label="Nominations"
              value={data!.health.nominations.toLocaleString()}
            />
          </>
        )}
      </div>

      {/* ── Compute & Database ── */}
      <SectionLabel>Compute &amp; Database</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !error && (
          <>
            <KpiCard
              label="ACA primary"
              value={data!.compute.aca_primary.toString()}
            />
            <KpiCard
              label="ACA secondary"
              value={data!.compute.aca_secondary.toString()}
            />
            <KpiCard
              label="SQL storage"
              value={`${data!.compute.sql_mb} MB`}
            />
            <KpiCard
              label="Sessions"
              value={data!.health.sessions.toLocaleString()}
            />
          </>
        )}
      </div>

      {/* ── Hourly chart ── */}
      {!isLoading && !error && data!.hourly.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-white/10 bg-[#0f0d18] p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Requests &amp; failures per hour
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data!.hourly}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatHour}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f0d18",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                labelFormatter={(label) => formatHour(String(label))}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2dd4bf"
                strokeWidth={2}
                dot={false}
                name="Requests"
              />
              <Line
                type="monotone"
                dataKey="failures"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
                name="Failures"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex gap-6">
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-0.5 w-6 rounded bg-teal-400" /> Requests
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-0.5 w-6 rounded bg-red-400" /> Failures
            </span>
          </div>
        </div>
      )}

      {/* ── How-it-works diagram modal ── */}
      {showDiagram && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={closeDiagram}
        >
          <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
            <div
              className="relative w-full rounded-2xl border-2 border-white/10 bg-[#0f0d18] p-6 shadow-2xl"
              style={{ minWidth: "860px", maxWidth: "960px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
                  How live metrics work
                </p>
                <button
                  onClick={closeDiagram}
                  className="rounded-md px-3 py-1 text-sm text-slate-400 hover:bg-white/10 hover:text-slate-100 transition"
                >
                  ✕ Close
                </button>
              </div>
              <div className="overflow-x-auto">
                <img
                  src="/award_live_metrics_workflow.svg"
                  alt="Live metrics workflow diagram"
                  className="rounded-lg"
                  style={{ minWidth: "820px", width: "100%" }}
                />
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">Click outside to close</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
