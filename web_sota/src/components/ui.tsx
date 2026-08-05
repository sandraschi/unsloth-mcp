import type { ReactNode } from "react";

export function KpiCard({
  testid,
  label,
  value,
  sub,
}: {
  testid: string;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div data-testid={testid} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function MockBadge() {
  return (
    <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-400 ring-1 ring-red-800">
      Mock
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-blue-500/15 text-blue-400 ring-blue-700",
    queued: "bg-amber-500/15 text-amber-400 ring-amber-700",
    done: "bg-green-500/15 text-green-400 ring-green-700",
    failed: "bg-red-500/15 text-red-400 ring-red-700",
    cancelled: "bg-zinc-500/15 text-zinc-400 ring-zinc-700",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
        colors[status] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  extra,
}: { title: string; subtitle?: string; extra?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold" data-testid="page-title">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {extra}
    </div>
  );
}
