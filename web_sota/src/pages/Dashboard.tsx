import { ArrowRight, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { type DashboardStats, api } from "../api";
import { KpiCard, MockBadge, PageHeader } from "../components/ui";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [onboarding, setOnboarding] = useState<{
    configured: boolean;
    checks: Record<string, boolean>;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardStats>("/api/dashboard")
      .then(setStats)
      .catch((e) => setError(String(e)));
    api
      .get<{ configured: boolean; checks: Record<string, boolean> }>("/api/onboarding/status")
      .then(setOnboarding)
      .catch(() => setOnboarding({ configured: false, checks: {} }));
  }, []);

  const gpu = stats?.gpu;
  const mock = !onboarding?.configured;

  return (
    <div data-testid="dashboard">
      <PageHeader title="Dashboard" subtitle="Local LLM fine-tuning via Unsloth on your GPU" />

      {error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!onboarding?.configured && (
        <div
          data-testid="onboarding-cue"
          className="mb-6 flex flex-col gap-3 rounded-xl border-2 border-red-700 bg-red-950/30 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Rocket className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <div className="font-semibold text-red-200">Unsloth environment not configured</div>
              <div className="mt-1 text-sm text-red-300/80">
                Install Unsloth Studio (
                <code className="rounded bg-red-900/40 px-1">
                  irm https://unsloth.ai/install.ps1 | iex
                </code>
                ) or set <code className="rounded bg-red-900/40 px-1">UNSLOTH_PYTHON</code>. See{" "}
                <a className="underline" href="/help">
                  Help → Onboarding
                </a>
                .
              </div>
            </div>
          </div>
          <a
            href="/help"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Start onboarding <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          testid="kpi-gpu"
          label="GPU"
          value={gpu?.available ? gpu.name?.replace("NVIDIA GeForce ", "") : "—"}
          sub={gpu?.available ? `driver ${gpu.driver}` : gpu?.reason}
        />
        <KpiCard
          testid="kpi-vram"
          label="VRAM Used / Total"
          value={
            gpu?.available && gpu.memory_total_mib && gpu.memory_used_mib
              ? `${Math.round(gpu.memory_used_mib / 1024)} / ${Math.round(gpu.memory_total_mib / 1024)} GB`
              : "—"
          }
          sub={gpu?.available ? `${gpu.utilization_pct}% util` : undefined}
        />
        <KpiCard
          testid="kpi-jobs"
          label="Active Jobs"
          value={`${stats?.jobs.running ?? 0} running · ${stats?.jobs.queued ?? 0} queued`}
          sub={`${stats?.jobs.done ?? 0} done · ${stats?.jobs.failed ?? 0} failed`}
        />
        <KpiCard
          testid="kpi-unsloth"
          label="Unsloth Env"
          value={onboarding?.checks.unsloth_env ? "Ready" : "Missing"}
          sub={stats?.unsloth_version ? `torch ${stats.unsloth_version}` : "check onboarding"}
        />
      </div>

      {mock && (
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
          <MockBadge /> Sample data shown until the Unsloth environment is configured - real stats
          replace these once onboarding completes.
        </div>
      )}
    </div>
  );
}
