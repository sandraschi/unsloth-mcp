import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/ui";

export default function Logs() {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const poll = () => {
      api
        .get<{ log: string[] }>("/api/logs")
        .then((r) => setLines(r.log))
        .catch((e) => setError(String(e)));
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div data-testid="logs-page">
      <PageHeader title="Logs" subtitle="Backend ring buffer (auto-refreshes every 3s)" />
      {error && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <pre
        className="h-[70vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-400"
        data-testid="log-view"
      >
        {lines.join("\n") || "(no log lines yet)"}
      </pre>
    </div>
  );
}
