const API_BASE = import.meta.env.VITE_API_TARGET || "http://127.0.0.1:11150";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    ...init,
  });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      detail = body.error || body.detail || detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return (await r.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface Health {
  status: string;
  server: string;
  version: string;
  uptime_seconds: number;
  tool_count: number;
  providers: Record<string, boolean>;
}

export interface JobSummary {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  error: string | null;
  output_dir: string | null;
  model_name?: string;
  max_steps?: number | null;
  num_train_epochs?: number | null;
  load_in_4bit?: boolean;
}

export interface JobsResponse {
  status: string;
  jobs: JobSummary[];
  counts: { running: number; queued: number; total: number };
}

export interface JobDetail extends JobSummary {
  config: Record<string, unknown>;
  log_tail: string[];
}

export interface GpuInfo {
  available: boolean;
  name?: string;
  driver?: string;
  memory_total_mib?: number;
  memory_used_mib?: number;
  memory_free_mib?: number;
  utilization_pct?: number;
  reason?: string;
}

export interface DashboardStats {
  status: string;
  gpu: GpuInfo;
  configured: boolean;
  jobs: { running: number; queued: number; done: number; failed: number; total: number };
  unsloth_version: string | null;
}

export interface Skill {
  name: string;
  uri: string;
}
