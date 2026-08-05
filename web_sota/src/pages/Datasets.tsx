import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/ui";

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
      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      <div className="overflow-hidden rounded-xl border border-zinc-800" data-testid="dataset-list">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Rows (est.)</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2">Path</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.path} className="border-t border-zinc-800">
                <td className="px-4 py-2 font-medium text-zinc-200">{d.name}</td>
                <td className="px-4 py-2 text-zinc-400">{d.rows_estimate}</td>
                <td className="px-4 py-2 text-zinc-400">{d.size_mb} MB</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">{d.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && datasets.length === 0 && (
          <div className="border-t border-zinc-800 p-6 text-center text-sm text-zinc-600">
            Drop .jsonl files into <code className="rounded bg-zinc-800 px-1">data/datasets/</code>{" "}
            (repo root).
          </div>
        )}
      </div>
    </div>
  );
}
