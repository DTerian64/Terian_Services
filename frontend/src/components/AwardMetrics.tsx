/**
 * AwardMetrics.tsx
 * ────────────────
 * Fetches last-24h metrics from /api/metrics/awards (FastAPI → App Insights)
 * and renders KPI cards + an hourly request/failure line chart.
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

// ── Types ────────────────────────────────────────────────────────────────────

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

type MetricsData = {
  summary: Summary;
  hourly: HourlyRow[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function failureRate(summary: Summary): string {
  if (!summary.total) return "—";
  return `${((summary.failures / summary.total) * 100).toFixed(1)}%`;
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

// ── Main component ────────────────────────────────────────────────────────────

export default function AwardMetrics() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [error, setError] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const openDiagram = useCallback(() => setShowDiagram(true), []);
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

      {/* KPI cards */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div className="col-span-4 rounded-xl border-2 border-white/10 bg-[#0f0d18] px-6 py-10 text-center text-sm text-slate-500">
            Metrics are temporarily unavailable — live telemetry refreshes every 5 minutes.
          </div>
        ) : (
          <>
            <KpiCard
              label="Total requests"
              value={data!.summary.total != null ? data!.summary.total.toLocaleString() : "—"}
            />
            <KpiCard
              label="Median latency"
              value={data!.summary.p50_ms != null ? `${data!.summary.p50_ms} ms` : "—"}
            />
            <KpiCard
              label="P95 latency"
              value={data!.summary.p95_ms != null ? `${data!.summary.p95_ms} ms` : "—"}
            />
            <KpiCard label="Failure rate" value={failureRate(data!.summary)} />
          </>
        )}
      </div>

      {/* Time-series chart */}
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

          {/* Legend */}
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
              {/* Header */}
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
              {/* SVG diagram — rendered at natural width, container scrolls horizontally on small screens */}
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
