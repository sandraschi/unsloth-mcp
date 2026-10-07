import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ListToolbar } from "../components/ListToolbar";
import { PageHeader } from "../components/ui";
import { useListControls } from "../hooks/useListControls";

interface Model {
  kind: string;
  path: string;
  size_mb?: number;
}

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const ctl = useListControls(models, {
    searchText: (m) => `${m.path} ${m.kind}`,
    sorts: {
      size: { label: "Size", compare: (a, b) => (b.size_mb ?? 0) - (a.size_mb ?? 0) },
      path: { label: "Path", compare: (a, b) => a.path.localeCompare(b.path) },
      kind: { label: "Kind", compare: (a, b) => a.kind.localeCompare(b.kind) },
    },
    defaultSort: "size",
    pageSize: 8,
  });

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
      {loading && <div className="text-sm text-zinc-300">Loading...</div>}
      <ListToolbar
        id="models"
        query={ctl.query}
        onQuery={ctl.setQuery}
        searchPlaceholder="Search path, kind..."
        sortKey={ctl.sortKey}
        onSortKey={ctl.setSortKey}
        sortOptions={ctl.sortOptions}
        onToggleSortDir={ctl.toggleSortDir}
        page={ctl.page}
        pageCount={ctl.pageCount}
        onPage={ctl.setPage}
        total={ctl.total}
        view={view}
        onView={setView}
      />
      {view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2" data-testid="model-list">
          {ctl.rows.map((m) => (
            <div key={m.path} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold uppercase text-zinc-300">
                  {m.kind}
                </span>
                {m.size_mb !== undefined && (
                  <span className="text-sm text-zinc-300">{m.size_mb} MB</span>
                )}
              </div>
              <div className="mt-2 break-all font-mono text-sm text-zinc-300">{m.path}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2" data-testid="model-list">
          {ctl.rows.map((m) => (
            <div
              key={m.path}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2"
            >
              <div className="min-w-0 truncate font-mono text-sm text-zinc-300">{m.path}</div>
              <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-300">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold uppercase">
                  {m.kind}
                </span>
                {m.size_mb !== undefined && <span>{m.size_mb} MB</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && ctl.total === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-300">
          {ctl.query
            ? "No models match the current search."
            : "No trained models yet - complete a training job to see artifacts here."}
        </div>
      )}
    </div>
  );
}
