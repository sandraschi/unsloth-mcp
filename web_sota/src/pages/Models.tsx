import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/ui";

interface Model {
  kind: string;
  path: string;
  size_mb?: number;
}

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .get<{ models: Model[] }>("/api/models")
      .then((r) => setModels(r.models))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div data-testid="models-page">
      <PageHeader
        title="Models"
        subtitle="Trained artifacts under data/models/"
        extra={
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />
      {error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      <div className="grid gap-3 md:grid-cols-2" data-testid="model-list">
        {models.map((m) => (
          <div key={m.path} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                {m.kind}
              </span>
              {m.size_mb !== undefined && (
                <span className="text-xs text-zinc-500">{m.size_mb} MB</span>
              )}
            </div>
            <div className="mt-2 break-all font-mono text-xs text-zinc-300">{m.path}</div>
          </div>
        ))}
        {!loading && models.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
            No trained models yet - complete a training job to see artifacts here.
          </div>
        )}
      </div>
    </div>
  );
}
