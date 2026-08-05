import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/ui";

interface Tool {
  name: string;
  description: string;
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ tools: Tool[] }>("/api/tools")
      .then((r) => setTools(r.tools))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="tools-page">
      <PageHeader title="Tools" subtitle="Dynamically discovered from the running MCP server" />
      {error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      <div className="grid gap-3 md:grid-cols-2" data-testid="tool-list">
        {tools.map((t) => (
          <div key={t.name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="font-mono text-sm font-medium text-amber-400">{t.name}</div>
            <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{t.description}</p>
          </div>
        ))}
        {!loading && tools.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
            No tools reported by the backend.
          </div>
        )}
      </div>
    </div>
  );
}
