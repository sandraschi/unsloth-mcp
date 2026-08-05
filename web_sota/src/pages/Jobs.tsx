import { Play, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type JobDetail, type JobsResponse, api } from "../api";
import { PageHeader, StatusBadge } from "../components/ui";

const EMPTY_FORM = {
  model_name: "unsloth/gemma-4-e2b-it",
  dataset: "",
  max_seq_length: "2048",
  load_in_4bit: true,
  r: "16",
  per_device_train_batch_size: "2",
  gradient_accumulation_steps: "4",
  max_steps: "60",
  num_train_epochs: "",
  learning_rate: "0.0002",
};

export default function Jobs() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [selected, setSelected] = useState<JobDetail | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const refresh = useCallback(() => {
    api
      .get<JobsResponse>("/api/jobs")
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const openJob = useCallback(async (id: string) => {
    setDetailError("");
    try {
      const j = await api.get<JobDetail>(`/api/jobs/${id}`);
      setSelected(j);
    } catch (e) {
      setDetailError(String(e));
    }
  }, []);

  const cancelJob = async (id: string) => {
    await api.del(`/api/jobs/${id}`);
    setSelected(null);
    refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/jobs", {
        model_name: form.model_name,
        dataset: form.dataset,
        max_seq_length: Number(form.max_seq_length),
        load_in_4bit: form.load_in_4bit,
        r: Number(form.r),
        per_device_train_batch_size: Number(form.per_device_train_batch_size),
        gradient_accumulation_steps: Number(form.gradient_accumulation_steps),
        max_steps: form.max_steps ? Number(form.max_steps) : null,
        num_train_epochs: form.num_train_epochs ? Number(form.num_train_epochs) : null,
        learning_rate: Number(form.learning_rate),
      });
      refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({
        ...f,
        [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  return (
    <div data-testid="jobs-page">
      <PageHeader
        title="Training Jobs"
        subtitle="Queue, monitor, and cancel fine-tuning runs"
        extra={
          <button
            onClick={refresh}
            data-testid="jobs-refresh"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={submit}
          data-testid="job-form"
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Start a training job
          </h2>
          {error && (
            <div className="mb-3 rounded border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500">Model (HuggingFace id)</label>
              <input
                data-testid="job-model"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                value={form.model_name}
                onChange={set("model_name")}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">
                Dataset - <code>hf://org/name</code> or path to <code>.jsonl</code> in data/datasets
              </label>
              <input
                data-testid="job-dataset"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                value={form.dataset}
                onChange={set("dataset")}
                placeholder="hf://laion/OIG"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500">Max steps (empty = epochs)</label>
                <input
                  data-testid="job-max-steps"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.max_steps}
                  onChange={set("max_steps")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Epochs</label>
                <input
                  data-testid="job-epochs"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.num_train_epochs}
                  onChange={set("num_train_epochs")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Seq length</label>
                <input
                  data-testid="job-seq"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.max_seq_length}
                  onChange={set("max_seq_length")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">LoRA rank (r)</label>
                <input
                  data-testid="job-r"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.r}
                  onChange={set("r")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Batch size</label>
                <input
                  data-testid="job-batch"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.per_device_train_batch_size}
                  onChange={set("per_device_train_batch_size")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Grad accumulation</label>
                <input
                  data-testid="job-accum"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.gradient_accumulation_steps}
                  onChange={set("gradient_accumulation_steps")}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Learning rate</label>
                <input
                  data-testid="job-lr"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  value={form.learning_rate}
                  onChange={set("learning_rate")}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    data-testid="job-4bit"
                    checked={form.load_in_4bit}
                    onChange={set("load_in_4bit")}
                  />
                  QLoRA 4-bit
                </label>
              </div>
            </div>
            <button
              type="submit"
              data-testid="job-submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> {submitting ? "Queuing..." : "Start training"}
            </button>
          </div>
        </form>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Job list
          </h2>
          <div className="space-y-2" data-testid="job-list">
            {data?.jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => openJob(j.id)}
                data-testid={`job-row-${j.id}`}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left hover:bg-zinc-800"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-zinc-300">{j.id}</div>
                  <div className="truncate text-sm">{j.model_name || j.kind}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                </div>
              </button>
            ))}
            {data && data.jobs.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
                No jobs yet - start your first fine-tune.
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm">{selected.id}</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs text-zinc-500">
                    {selected.kind} · created {selected.created_at}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {selected.status === "running" && (
                  <button
                    onClick={() => cancelJob(selected.id)}
                    data-testid="job-cancel"
                    className="flex items-center gap-1 rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
            {detailError && (
              <div className="mb-3 rounded border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">
                {detailError}
              </div>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-zinc-800/60 p-2">
                <span className="text-zinc-500">output_dir</span>
                <div className="break-all text-zinc-300">{selected.output_dir || "—"}</div>
              </div>
              <div className="rounded bg-zinc-800/60 p-2">
                <span className="text-zinc-500">exit_code</span>
                <div className="text-zinc-300">{selected.exit_code ?? "—"}</div>
              </div>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Log tail
            </div>
            <pre className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
              {selected.log_tail.join("\n") || "no log output yet"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
