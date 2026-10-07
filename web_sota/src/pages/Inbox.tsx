import { useEffect, useMemo, useState } from "react";
import { type JobsResponse, api } from "../api";
import { ListToolbar } from "../components/ListToolbar";
import { PageHeader, StatusBadge } from "../components/ui";
import { useListControls } from "../hooks/useListControls";

export default function Inbox() {
  const [events, setEvents] = useState<JobsResponse["jobs"]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");

  const completed = useMemo(
    () =>
      events
        .filter((j) => ["done", "failed", "cancelled"].includes(j.status))
        .filter((j) => status === "all" || j.status === status),
    [events, status],
  );
  const ctl = useListControls(completed, {
    searchText: (j) => `${j.id} ${j.model_name ?? ""} ${j.kind} ${j.status} ${j.error ?? ""}`,
    sorts: {
      finished: {
        label: "Finished",
        compare: (a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""),
      },
      status: { label: "Status", compare: (a, b) => a.status.localeCompare(b.status) },
    },
    defaultSort: "finished",
    pageSize: 8,
  });

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
      {loading && <div className="text-sm text-zinc-300">Loading...</div>}
      <ListToolbar
        id="inbox"
        query={ctl.query}
        onQuery={ctl.setQuery}
        searchPlaceholder="Search id, model, error..."
        sortKey={ctl.sortKey}
        onSortKey={ctl.setSortKey}
        sortOptions={ctl.sortOptions}
        onToggleSortDir={ctl.toggleSortDir}
        filterValue={status}
        filterOptions={[
          { value: "all", label: "All outcomes" },
          { value: "done", label: "Done" },
          { value: "failed", label: "Failed" },
          { value: "cancelled", label: "Cancelled" },
        ]}
        onFilter={setStatus}
        page={ctl.page}
        pageCount={ctl.pageCount}
        onPage={ctl.setPage}
        total={ctl.total}
      />
      <div className="space-y-2" data-testid="inbox-list">
        {ctl.rows.map((j) => (
          <div
            key={j.id}
            className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
          >
            <div>
              <div className="font-mono text-sm text-zinc-300">{j.id}</div>
              <div className="text-sm text-zinc-200">
                {j.kind === "train"
                  ? `Training finished: ${j.model_name}`
                  : `Export finished: ${j.output_dir}`}
              </div>
              <div className="mt-0.5 text-sm text-zinc-300">
                {j.finished_at ?? ""}
                {j.exit_code !== null && j.exit_code !== 0 && ` · exit ${j.exit_code}`}
                {j.error && ` · ${j.error}`}
              </div>
            </div>
            <StatusBadge status={j.status} />
          </div>
        ))}
        {!loading && ctl.total === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-300">
            {ctl.query || status !== "all" ? "No events match." : "No completed jobs yet."}
          </div>
        )}
      </div>
    </div>
  );
}
