import { useCallback, useEffect, useState } from "react";
import { type Health, api } from "../api";
import { KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { useLLMStore } from "../store/llm";

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [onboarding, setOnboarding] = useState<{
    configured: boolean;
    checks: Record<string, boolean>;
    studio: { running: boolean; url?: string };
    next_steps: string[];
  } | null>(null);
  const [installJob, setInstallJob] = useState<{
    id: string;
    status: string;
    log_tail: string[];
  } | null>(null);
  const [envBusy, setEnvBusy] = useState(false);
  const [envError, setEnvError] = useState("");
  const {
    providers,
    providerStatus,
    selectedProvider,
    setSelectedProvider,
    setAvailableModels,
    selectedModel,
    setSelectedModel,
    availableModels,
  } = useLLMStore();

  const refreshOnboarding = useCallback(() => {
    api
      .get<{
        configured: boolean;
        checks: Record<string, boolean>;
        studio: { running: boolean; url?: string };
        next_steps: string[];
      }>("/api/onboarding/status")
      .then(setOnboarding)
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<Health>("/api/health")
      .then(setHealth)
      .catch(() => {});
    refreshOnboarding();
    api
      .get<{ providers: typeof providers }>("/api/llm/discover")
      .then((r) => {
        r.providers.forEach((p) => {
          if (p.detected) {
            setAvailableModels(p.models);
          }
        });
      })
      .catch(() => {});
  }, [refreshOnboarding, setAvailableModels]);

  const startInstall = async () => {
    setEnvBusy(true);
    setEnvError("");
    try {
      const r = await api.post<{ data: { job_id: string } }>("/api/env/install", {});
      const poll = async () => {
        const j = await api.get<{ id: string; status: string; log_tail: string[] }>(
          `/api/jobs/${r.data.job_id}`,
        );
        setInstallJob(j);
        if (["done", "failed", "cancelled"].includes(j.status)) {
          setEnvBusy(false);
          refreshOnboarding();
          return;
        }
        setTimeout(poll, 4000);
      };
      poll();
    } catch (e) {
      setEnvError(String(e));
      setEnvBusy(false);
    }
  };

  const toggleStudio = async () => {
    setEnvBusy(true);
    setEnvError("");
    try {
      await api.post(
        onboarding?.studio.running ? "/api/env/studio/stop" : "/api/env/studio/start",
        {},
      );
      setTimeout(() => {
        refreshOnboarding();
        setEnvBusy(false);
      }, 1500);
    } catch (e) {
      setEnvError(String(e));
      setEnvBusy(false);
    }
  };

  const selected = providers.find((p) => p.name === selectedProvider);

  return (
    <div data-testid="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Backend health, environment, and local LLM providers"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          testid="kpi-server"
          label="Server"
          value={health?.server ?? "—"}
          sub={`v${health?.version ?? "?"}`}
        />
        <KpiCard
          testid="kpi-tools"
          label="Tools"
          value={health?.tool_count ?? "—"}
          sub={`uptime ${health ? `${Math.floor(health.uptime_seconds / 60)}m` : "?"}`}
        />
        <KpiCard
          testid="kpi-gpu-provider"
          label="GPU"
          value={onboarding?.checks.gpu ? "Detected" : "Not found"}
          sub={onboarding?.checks.gpu ? "ready for training" : "install drivers"}
        />
        <KpiCard
          testid="kpi-unsloth-provider"
          label="Unsloth"
          value={onboarding?.checks.unsloth_env ? "Ready" : "Missing"}
          sub={onboarding?.configured ? "configured" : "see onboarding"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Environment status
          </h2>
          <div className="space-y-2 text-sm">
            {Object.entries(onboarding?.checks ?? {}).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2"
              >
                <span className="text-zinc-400">{k}</span>
                <span className={v ? "text-green-400" : "text-red-400"}>
                  {v ? "ready" : "missing"}
                </span>
              </div>
            ))}
            {onboarding && !onboarding.configured && (
              <ul className="list-inside list-disc space-y-1 pt-2 text-xs text-zinc-500">
                {onboarding.next_steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">
                Unsloth Studio{" "}
                <span className={onboarding?.studio.running ? "text-green-400" : "text-zinc-500"}>
                  {onboarding?.studio.running ? "running" : "stopped"}
                </span>
                {onboarding?.studio.running && (
                  <a
                    href={onboarding.studio.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-amber-400 underline"
                  >
                    open :8888
                  </a>
                )}
              </span>
              {onboarding?.configured && (
                <button
                  onClick={toggleStudio}
                  disabled={envBusy}
                  data-testid="settings-studio-toggle"
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-50"
                >
                  {envBusy ? "..." : onboarding.studio.running ? "Stop Studio" : "Start Studio"}
                </button>
              )}
            </div>

            {!onboarding?.configured && (
              <div className="mt-3">
                <button
                  onClick={startInstall}
                  disabled={envBusy}
                  data-testid="settings-env-install"
                  className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {envBusy ? "Working..." : "Install Unsloth automatically (~2.8 GB)"}
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  Runs the official installer as a tracked job - you can watch progress on the
                  Dashboard. Alternative:{" "}
                  <code className="rounded bg-zinc-800 px-1">
                    irm https://unsloth.ai/install.ps1 | iex
                  </code>
                </p>
              </div>
            )}

            {installJob && (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400">{installJob.id}</span>
                  <StatusBadge status={installJob.status} />
                </div>
                <pre className="mt-2 max-h-32 overflow-y-auto font-mono text-[10px] text-zinc-500">
                  {installJob.log_tail.slice(-8).join("\n") || "waiting for installer output..."}
                </pre>
              </div>
            )}

            {envError && (
              <div className="mt-3 rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
                {envError}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Local LLM providers
          </h2>
          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2 text-sm"
              >
                <span className="text-zinc-300">
                  {p.name} <span className="text-zinc-600">:{p.port}</span>
                </span>
                <span
                  className={
                    providerStatus[p.name] === "detected" ? "text-green-400" : "text-zinc-600"
                  }
                >
                  {providerStatus[p.name] === "detected"
                    ? `Detected (${p.models.length} models)`
                    : "Not found"}
                </span>
              </div>
            ))}
            {providers.length === 0 && <div className="text-sm text-zinc-600">Probing...</div>}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500">Provider</label>
              <select
                data-testid="llm-provider-select"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  const p = providers.find((x) => x.name === e.target.value);
                  if (p) setAvailableModels(p.models);
                }}
              >
                {providers
                  .filter((p) => p.detected)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                {!selected && <option value="">No local LLM detected</option>}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Model</label>
              <select
                data-testid="llm-model-select"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {(selected?.models ?? availableModels).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
