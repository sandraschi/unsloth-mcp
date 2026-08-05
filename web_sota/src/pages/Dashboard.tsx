import { ArrowRight, Download, ExternalLink, Play, Rocket, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type DashboardStats, type JobDetail, api } from "../api";
import { KpiCard, MockBadge, PageHeader, StatusBadge } from "../components/ui";

interface Onboarding {
  configured: boolean;
  checks: Record<string, boolean>;
  studio: { running: boolean; url?: string };
  next_steps: string[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [error, setError] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installJob, setInstallJob] = useState<JobDetail | null>(null);
  const [studioBusy, setStudioBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .get<DashboardStats>("/api/dashboard")
      .then(setStats)
      .catch((e) => setError(String(e)));
    api
      .get<Onboarding>("/api/onboarding/status")
      .then(setOnboarding)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  // While an install job exists, poll its status for live progress.
  useEffect(() => {
    if (!installJob) return;
    const t = setInterval(async () => {
      try {
        const j = await api.get<JobDetail>(`/api/jobs/${installJob.id}`);
        setInstallJob(j);
        if (j.status === "done" || j.status === "failed" || j.status === "cancelled") {
          clearInterval(t);
          setInstalling(false);
          refresh();
        }
      } catch {
        clearInterval(t);
        setInstalling(false);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [installJob, refresh]);

  const startInstall = async () => {
    setError("");
    setInstalling(true);
    try {
      const r = await api.post<{ data: { job_id: string } }>("/api/env/install", {});
      const j = await api.get<JobDetail>(`/api/jobs/${r.data.job_id}`);
      setInstallJob(j);
    } catch (e) {
      setError(String(e));
      setInstalling(false);
    }
  };

  const toggleStudio = async () => {
    setStudioBusy(true);
    setError("");
    try {
      await api.post(
        onboarding?.studio.running ? "/api/env/studio/stop" : "/api/env/studio/start",
        {},
      );
      setTimeout(refresh, 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setStudioBusy(false);
    }
  };

  const gpu = stats?.gpu;
  const mock = !onboarding?.configured;
  const showInstallProgress =
    installing || (installJob && ["queued", "running"].includes(installJob.status));

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
          className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-red-700 bg-red-950/30 p-5"
        >
          <div className="flex items-start gap-3">
            <Rocket className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <div className="font-semibold text-red-200">Unsloth environment not configured</div>
              <div className="mt-1 text-sm text-red-300/80">
                Training needs Unsloth installed (PyTorch + CUDA kernels, ~2.8 GB). The server can
                install it for you automatically, or you can install it manually.
              </div>
            </div>
          </div>

          {showInstallProgress && installJob ? (
            <div className="rounded-lg border border-red-800 bg-red-950/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-red-200">{installJob.id}</span>
                <StatusBadge status={installJob.status} />
              </div>
              <div className="mt-2 text-xs text-red-300/80">
                Downloading ~2.8 GB (PyTorch + Unsloth + llama.cpp). This takes 10-30 minutes - live
                progress in the job log below.
              </div>
              <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-400">
                {installJob.log_tail.slice(-12).join("\n") || "waiting for installer output..."}
              </pre>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={startInstall}
                disabled={installing}
                data-testid="env-install"
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />{" "}
                {installing ? "Queuing install..." : "Install Unsloth (auto, ~2.8 GB)"}
              </button>
              <a
                href="/help"
                className="flex items-center gap-2 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
              >
                Manual install guide <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      )}

      {onboarding?.configured && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span
              className={`h-2 w-2 rounded-full ${onboarding.studio.running ? "bg-green-500" : "bg-zinc-600"}`}
            />
            Unsloth Studio {onboarding.studio.running ? "running" : "stopped"}
            {onboarding.studio.running && (
              <a
                href={onboarding.studio.url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 text-amber-400 hover:underline"
              >
                open UI <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <button
            onClick={toggleStudio}
            disabled={studioBusy}
            data-testid="studio-toggle"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {onboarding.studio.running ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {studioBusy ? "..." : onboarding.studio.running ? "Stop Studio" : "Start Studio"}
          </button>
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
