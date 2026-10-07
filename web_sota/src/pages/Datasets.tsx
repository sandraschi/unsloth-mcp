import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ListToolbar } from "../components/ListToolbar";
import { PageHeader } from "../components/ui";
import { useListControls } from "../hooks/useListControls";

interface Dataset {
  name: string;
  path: string;
  size_mb: number;
  rows_estimate: number;
}

export default function Datasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ctl = useListControls(datasets, {
    searchText: (d) => `${d.name} ${d.path}`,
    sorts: {
      size: { label: "Size", compare: (a, b) => b.size_mb - a.size_mb },
      rows: { label: "Rows", compare: (a, b) => b.rows_estimate - a.rows_estimate },
      name: { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    },
    defaultSort: "size",
    pageSize: 10,
  });

  useEffect(() => {
    api
      .get<{ datasets: Dataset[] }>("/api/datasets")
      .then((r) => setDatasets(r.datasets))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="datasets-page">
      <PageHeader
        title="Datasets"
        subtitle="Local datasets usable with dataset='path' in a training job"
        extra={
          <button
            onClick={() => {
              setLoading(true);
              api
                .get<{ datasets: Dataset[] }>("/api/datasets")
                .then((r) => setDatasets(r.datasets))
                .catch((e) => setError(String(e)))
                .finally(() => setLoading(false));
            }}
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
        id="datasets"
        query={ctl.query}
        onQuery={ctl.setQuery}
        searchPlaceholder="Search name, path..."
        sortKey={ctl.sortKey}
        onSortKey={ctl.setSortKey}
        sortOptions={ctl.sortOptions}
        onToggleSortDir={ctl.toggleSortDir}
        page={ctl.page}
        pageCount={ctl.pageCount}
        onPage={ctl.setPage}
        total={ctl.total}
      />
      <div className="overflow-hidden rounded-xl border border-zinc-800" data-testid="dataset-list">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-sm uppercase text-zinc-300">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Rows (est.)</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2">Path</th>
            </tr>
          </thead>
          <tbody>
            {ctl.rows.map((d) => (
              <tr key={d.path} className="border-t border-zinc-800">
                <td className="px-4 py-2 font-medium text-zinc-200">{d.name}</td>
                <td className="px-4 py-2 text-zinc-300">{d.rows_estimate}</td>
                <td className="px-4 py-2 text-zinc-300">{d.size_mb} MB</td>
                <td className="px-4 py-2 font-mono text-sm text-zinc-300">{d.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && ctl.total === 0 && (
          <div className="border-t border-zinc-800 p-6 text-center text-sm text-zinc-300">
            {ctl.query ? (
              "No datasets match the current search."
            ) : (
              <>
                Drop .jsonl files into{" "}
                <code className="rounded bg-zinc-800 px-1">data/datasets/</code> (repo root).
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
