import { useEffect, useState } from "react";
import { type Health, api } from "../api";
import { KpiCard, PageHeader } from "../components/ui";
import { useLLMStore } from "../store/llm";

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [onboarding, setOnboarding] = useState<{
    configured: boolean;
    checks: Record<string, boolean>;
    next_steps: string[];
  } | null>(null);
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

  useEffect(() => {
    api
      .get<Health>("/api/health")
      .then(setHealth)
      .catch(() => {});
    api
      .get<{ configured: boolean; checks: Record<string, boolean>; next_steps: string[] }>(
        "/api/onboarding/status",
      )
      .then(setOnboarding)
      .catch(() => {});
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
  }, [setAvailableModels]);

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
