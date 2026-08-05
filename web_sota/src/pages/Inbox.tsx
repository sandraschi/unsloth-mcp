import { useEffect, useState } from "react";
import { type JobsResponse, api } from "../api";
import { PageHeader, StatusBadge } from "../components/ui";

export default function Inbox() {
  const [events, setEvents] = useState<JobsResponse["jobs"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<JobsResponse>("/api/jobs?limit=20")
      .then((r) =>
        setEvents(r.jobs.filter((j) => ["done", "failed", "cancelled"].includes(j.status))),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="inbox-page">
      <PageHeader
        title="Inbox"
        subtitle="Completed training events - what finished and whether it worked"
      />
      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      <div className="space-y-2" data-testid="inbox-list">
        {events.map((j) => (
          <div
            key={j.id}
            className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
          >
            <div>
              <div className="font-mono text-xs text-zinc-400">{j.id}</div>
              <div className="text-sm text-zinc-200">
                {j.kind === "train"
                  ? `Training finished: ${j.model_name}`
                  : `Export finished: ${j.output_dir}`}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {j.finished_at ?? ""}
                {j.exit_code !== null && j.exit_code !== 0 && ` · exit ${j.exit_code}`}
                {j.error && ` · ${j.error}`}
              </div>
            </div>
            <StatusBadge status={j.status} />
          </div>
        ))}
        {!loading && events.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
            No completed jobs yet.
          </div>
        )}
      </div>
    </div>
  );
}
