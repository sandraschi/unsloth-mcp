import { useState } from "react";
import { PageHeader } from "../components/ui";

type Tab = "overview" | "env" | "training" | "tools" | "troubleshooting";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "env", label: "Environment & Install" },
  { id: "training", label: "Training Guide" },
  { id: "tools", label: "Tool Reference" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-zinc-800 px-1 py-0.5 text-[12px] text-amber-300">{children}</code>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400 first:mt-0">
      {children}
    </h2>
  );
}

export default function Help() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div data-testid="help-page" className="max-w-4xl">
      <PageHeader
        title="Help"
        subtitle="How unsloth-mcp works - environment, training, tools, troubleshooting"
      />

      <div
        className="mb-6 flex flex-wrap gap-1 border-b border-zinc-800"
        data-testid="help-tabs"
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            data-testid={`help-tab-${t.id}`}
            className={`rounded-t-lg border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300"
          data-testid="help-panel-overview"
        >
          <H2>What this server does</H2>
          <p>
            unsloth-mcp is a control plane for <strong>local LLM fine-tuning</strong> on your NVIDIA
            GPU. It wraps{" "}
            <a
              className="text-amber-400 underline"
              href="https://unsloth.ai"
              target="_blank"
              rel="noreferrer"
            >
              Unsloth
            </a>{" "}
            - an open-source stack that trains LoRA/QLoRA adapters ~2x faster and with ~70% less
            VRAM than vanilla HuggingFace training. The server queues <em>training jobs</em>, runs
            them in a separate Unsloth environment, and hands you back GGUF models you can serve
            through Ollama.
          </p>
          <H2>The three roles</H2>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Unsloth</strong> (the wrappee) - does the actual training math on the GPU.
              Installed separately (or by this server, see Environment tab).
            </li>
            <li>
              <strong>unsloth-mcp</strong> (this server) - the brain: job queue, VRAM guard, export
              pipeline, Ollama registration, webapp.
            </li>
            <li>
              <strong>Ollama</strong> (optional) - serves finished models on port 11434 so every app
              can use them.
            </li>
          </ul>
          <H2>How a fine-tune flows</H2>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              You pick a base model (e.g. <Code>unsloth/gemma-4-e2b-it</Code>) and a dataset.
            </li>
            <li>
              The server queues a training job; one job runs at a time (VRAM guard protects the
              shared GPU).
            </li>
            <li>
              Training runs as a subprocess in the Unsloth environment - the server stays
              responsive, you watch logs live.
            </li>
            <li>
              On completion the run is exported to a quantized <Code>GGUF</Code> file.
            </li>
            <li>
              You register it in Ollama under a tag (e.g. <Code>gemma-notes:q4_k_m</Code>) -
              instantly available fleet-wide.
            </li>
          </ol>
          <H2>What fits on 24 GB</H2>
          <p>
            QLoRA (4-bit) training fits up to ~27B parameters (comfortable sweet spot 7B-14B).
            16-bit LoRA fits up to ~9B. 32B+ does not fit for training. Batch size 1-3 on 7B-14B
            QLoRA.
          </p>
          <H2>Ports</H2>
          <p>
            Backend <Code>http://127.0.0.1:11150</Code> (REST <Code>/api/*</Code> + MCP{" "}
            <Code>/mcp</Code>) · Frontend <Code>http://127.0.0.1:11151</Code> · Ollama{" "}
            <Code>11434</Code> · Unsloth Studio <Code>8888</Code>.
          </p>
        </div>
      )}

      {tab === "env" && (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300"
          data-testid="help-panel-env"
        >
          <H2>What the environment is</H2>
          <p>
            Training needs a Python environment with <Code>unsloth</Code>, <Code>trl</Code>,{" "}
            <Code>torch</Code> (CUDA), and <Code>triton</Code>. The server never imports these
            itself - it spawns jobs with the interpreter configured by <Code>UNSLOTH_PYTHON</Code>.
            The default points at the Unsloth Studio venv:
          </p>
          <p className="my-2">
            <Code>C:\Users\sandr\.unsloth\studio\unsloth_studio\Scripts\python.exe</Code>
          </p>
          <H2>Detect</H2>
          <p>
            The server probes this interpreter on startup (background warm-up) and every 30s: torch
            version, CUDA availability, unsloth/trl presence. Results are shown on the Dashboard KPI
            and in Settings → Environment status. The dashboard shows <em>Ready</em> only when the
            probe succeeds.
          </p>
          <H2>Install automatically (recommended)</H2>
          <p>
            When the environment is missing, the Dashboard shows a red banner with an{" "}
            <strong>Install Unsloth (auto)</strong> button. It runs the official installer (
            <Code>irm https://unsloth.ai/install.ps1 | iex</Code>) as a tracked job:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              ~2.8 GB download (PyTorch CUDA build + Unsloth + prebuilt llama.cpp) - 10-30 minutes.
            </li>
            <li>Live progress streams to the job log; you can cancel it.</li>
            <li>No admin rights needed (user-scope install).</li>
            <li>After completion the server re-probes automatically and the banner clears.</li>
          </ul>
          <H2>Manual install (alternative)</H2>
          <p>
            In a terminal: <Code>irm https://unsloth.ai/install.ps1 | iex</Code> (same command
            updates later). Or point <Code>UNSLOTH_PYTHON</Code> at any interpreter with unsloth
            installed (<Code>uv pip install unsloth --torch-backend=auto</Code>).
          </p>
          <H2>Unsloth Studio (the GUI)</H2>
          <p>
            The Unsloth install also provides <strong>Studio</strong> - a web UI for browsing
            models, building datasets, training, and chatting. This server can start it for you:
            Dashboard → Start Studio (or <Code>unsloth_ops(operation="env_studio_start")</Code>). It
            serves on
            <Code>http://127.0.0.1:8888</Code> after ~30-60s first launch. The server tracks the PID
            it started and can stop it cleanly; a Studio you started manually in your own terminal
            is left alone.
          </p>
          <H2>Verification</H2>
          <p>
            Open Settings → Environment status. Green = ready. If GPU is missing, install NVIDIA
            drivers. If Unsloth shows missing after an install job claims success, check the job log
            tail - the installer may have hit a network/driver issue.
          </p>
        </div>
      )}

      {tab === "training" && (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300"
          data-testid="help-panel-training"
        >
          <H2>1. Validate with a smoke run</H2>
          <p>
            Before a real run, always do a <strong>60-step smoke run</strong>: Jobs page → model
            <Code>unsloth/gemma-4-e2b-it</Code>, dataset <Code>hf://laion/OIG</Code>, max steps 60,
            batch 2. This validates the environment, dataset, and training loop in minutes and
            catches OOM cheaply.
          </p>
          <H2>2. Pick the right model and dataset</H2>
          <ul className="list-inside list-disc space-y-1">
            <li>
              24 GB budget: 7B-14B QLoRA is the sweet spot (Gemma 4 12B, Qwen3.5 4B, Llama 3.1 8B,
              gpt-oss 20B).
            </li>
            <li>
              Datasets: <Code>hf://org/name</Code> for HuggingFace, or a local <Code>.jsonl</Code>{" "}
              file with a <Code>text</Code> column in <Code>data/datasets/</Code>.
            </li>
            <li>
              Format: <Code>{'{"text": "instruction\\n\\nresponse"}'}</Code> per line; 500-20k
              examples is the productive band.
            </li>
          </ul>
          <H2>3. Hyperparameters (sane defaults)</H2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-500">
                <th className="py-1 pr-3">Setting</th>
                <th className="py-1 pr-3">Default</th>
                <th className="py-1">When to change</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr>
                <td className="py-1 pr-3">r / lora_alpha</td>
                <td className="py-1 pr-3">16 / 16</td>
                <td className="py-1">8 for lighter, 32-64 for more capacity</td>
              </tr>
              <tr>
                <td className="py-1 pr-3">batch</td>
                <td className="py-1 pr-3">2</td>
                <td className="py-1">1 on OOM</td>
              </tr>
              <tr>
                <td className="py-1 pr-3">sequence</td>
                <td className="py-1 pr-3">2048</td>
                <td className="py-1">1024 for short texts / faster runs</td>
              </tr>
              <tr>
                <td className="py-1 pr-3">learning rate</td>
                <td className="py-1 pr-3">2e-4</td>
                <td className="py-1">1e-4 to 3e-4 typical for QLoRA</td>
              </tr>
              <tr>
                <td className="py-1 pr-3">steps vs epochs</td>
                <td className="py-1 pr-3">max_steps</td>
                <td className="py-1">epochs for small datasets only</td>
              </tr>
            </tbody>
          </table>
          <H2>4. Monitor</H2>
          <p>
            The Jobs page refreshes every 5s: status, exit code, log tail. A decreasing loss is
            healthy. Only one job runs at a time; extras wait <em>queued</em>. Cancel anytime (kills
            the process tree).
          </p>
          <H2>5. Export + serve</H2>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              When the job is <em>done</em>, export: Jobs → job detail → Export (q4_k_m default,
              q8_0/f16 available).
            </li>
            <li>
              Register in Ollama under a tag like <Code>gemma-notes:q4_k_m</Code>.
            </li>
            <li>Done - chat with it from any Ollama client, including every fleet webapp.</li>
          </ol>
          <H2>GPU contention</H2>
          <p>
            The GPU is shared with Ollama serving. During training, expect degraded inference. Pause
            Ollama for long runs (<Code>ollama stop</Code>). The VRAM guard refuses new jobs while
            the GPU is busy (threshold <Code>UNSLOTH_VRAM_GUARD</Code>, default 0.85).
          </p>
        </div>
      )}

      {tab === "tools" && (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300"
          data-testid="help-panel-tools"
        >
          <H2>unsloth_ops - the portmanteau</H2>
          <p>
            Everything flows through one tool with an <Code>operation</Code> discriminator:
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-500">
                <th className="py-1 pr-3">Operation</th>
                <th className="py-1 pr-3">Purpose</th>
                <th className="py-1">Key args</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr>
                <td className="py-1 pr-3 font-mono">system</td>
                <td className="py-1 pr-3">GPU/VRAM/env/Ollama/Studio status</td>
                <td className="py-1">-</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">train</td>
                <td className="py-1 pr-3">start a fine-tune job</td>
                <td className="py-1">model_name, dataset, max_steps...</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">jobs_list / jobs_status</td>
                <td className="py-1 pr-3">list / inspect jobs</td>
                <td className="py-1">limit, offset / job_id</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">jobs_cancel</td>
                <td className="py-1 pr-3">stop a job</td>
                <td className="py-1">job_id</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">jobs_export</td>
                <td className="py-1 pr-3">GGUF export job</td>
                <td className="py-1">job_id, quantization_method</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">jobs_register_ollama</td>
                <td className="py-1 pr-3">serve in Ollama</td>
                <td className="py-1">job_id, model_name_to_register</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">models_list / datasets_list</td>
                <td className="py-1 pr-3">list artifacts</td>
                <td className="py-1">-</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">env_install</td>
                <td className="py-1 pr-3">install Unsloth (job, ~2.8 GB)</td>
                <td className="py-1">-</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-mono">env_studio_start / env_studio_stop</td>
                <td className="py-1 pr-3">start/stop Studio UI (8888)</td>
                <td className="py-1">-</td>
              </tr>
            </tbody>
          </table>
          <H2>Prefab dashboards</H2>
          <p>
            <Code>show_training_app</Code> (GPU + jobs) and <Code>show_system_app</Code> (env
            readiness) render rich cards in chat.
          </p>
          <H2>REST API (webapp surface)</H2>
          <p>
            Health <Code>/api/health</Code> · diagnostics <Code>/api/v1/diagnostics</Code> · jobs
            CRUD
            <Code>/api/jobs</Code> · models <Code>/api/models</Code> · datasets{" "}
            <Code>/api/datasets</Code> · skills <Code>/api/skills</Code> · env{" "}
            <Code>/api/env/install</Code>, <Code>/api/env/studio/start|stop</Code> · onboarding{" "}
            <Code>/api/onboarding/status</Code> · LLM probes <Code>/api/llm/discover</Code> · chat
            proxy <Code>/api/llm/chat</Code> · logs <Code>/api/logs</Code>. MCP transport:{" "}
            <Code>/mcp</Code>. Full reference:{" "}
            <a className="text-amber-400 underline" href="/settings">
              docs/TOOLS.md
            </a>
            .
          </p>
        </div>
      )}

      {tab === "troubleshooting" && (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300"
          data-testid="help-panel-troubleshooting"
        >
          <H2>Jobs stay queued forever</H2>
          <p>
            <strong>Cause</strong>: one job at a time + VRAM guard. <strong>Fix</strong>: check
            system op - cancel the running job or free VRAM (<Code>ollama stop</Code>).
          </p>
          <H2>Install job fails</H2>
          <p>
            <strong>Cause</strong>: network (HuggingFace/PyTorch CDN), disk space, or driver issues.{" "}
            <strong>Fix</strong>: read the job log tail; retry once; check 20+ GB free disk; verify
            NVIDIA drivers are current. The installer is idempotent.
          </p>
          <H2>Job fails instantly with exit 1</H2>
          <p>
            <strong>Cause</strong>: <Code>UNSLOTH_PYTHON</Code> lacks unsloth/trl/torch or CUDA.{" "}
            <strong>Fix</strong>: probe with{" "}
            <Code>&amp; "&lt;python&gt;" -c "import torch; print(torch.cuda.is_available())"</Code>{" "}
            then reinstall or re-point the variable.
          </p>
          <H2>CUDA out of memory</H2>
          <p>
            <strong>Fix</strong>: batch 1, sequence 1024, QLoRA 4-bit on. 32B+ models do not fit 24
            GB - use ≤27B QLoRA.
          </p>
          <H2>Dataset errors (KeyError text, empty)</H2>
          <p>
            <strong>Fix</strong>: JSONL must have a non-empty <Code>text</Code> field per line;
            verify with <Code>datasets_list</Code> and by opening the file.
          </p>
          <H2>Ollama registration fails</H2>
          <p>
            <strong>Fix</strong>: Ollama running? (<Code>ollama list</Code>). Tag shape{" "}
            <Code>name:quant</Code>. GGUF exists under <Code>data/models/</Code>?
          </p>
          <H2>Webapp shows Offline</H2>
          <p>
            <strong>Fix</strong>: restart via <Code>start.bat</Code> - it clears ports 11150/11151
            first. Frontend proxies to 11150.
          </p>
          <H2>Studio won't start</H2>
          <p>
            <strong>Fix</strong>: environment must be installed (check Settings). First launch takes
            30-60s (llama.cpp setup). Port 8888 must be free. If a Studio you started manually holds
            8888, stop it there - this server only manages its own PID.
          </p>
          <H2>Server restart killed my job</H2>
          <p>
            Expected: subprocesses die with the server; the job is marked{" "}
            <Code>failed (server restarted)</Code>. Resubmit - the model cache makes the rerun
            faster.
          </p>
          <H2>More</H2>
          <p>
            Full FAQ:{" "}
            <a className="text-amber-400 underline" href="/settings">
              docs/TROUBLESHOOTING.md
            </a>{" "}
            · env vars:{" "}
            <a className="text-amber-400 underline" href="/settings">
              docs/CONFIGURATION.md
            </a>{" "}
            · onboarding:{" "}
            <a className="text-amber-400 underline" href="/settings">
              docs/ONBOARDING.md
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
