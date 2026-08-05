import { PageHeader } from "../components/ui";

export default function Help() {
  return (
    <div data-testid="help-page" className="max-w-3xl">
      <PageHeader title="Help" subtitle="Architecture, ports, environment, troubleshooting" />

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Onboarding (first time)
        </h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-300">
          <li>
            Install <strong>Unsloth Studio</strong> (provides the training environment + GPU
            kernels):{" "}
            <code className="rounded bg-zinc-800 px-1">
              irm https://unsloth.ai/install.ps1 | iex
            </code>
          </li>
          <li>
            Optionally install <strong>Ollama</strong> for serving exported models:{" "}
            <code className="rounded bg-zinc-800 px-1">winget install Ollama.Ollama</code>
          </li>
          <li>
            Restart this server - the dashboard shows <em>Ready</em> when the environment is
            detected.
          </li>
        </ol>
        <p className="mt-2 text-xs text-zinc-500">
          Full walkthrough:{" "}
          <a className="underline" href="/settings">
            Settings → Environment status
          </a>
        </p>
      </section>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Architecture
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
          <li>
            <strong>Backend</strong>: FastAPI + FastMCP 3.4 at{" "}
            <code className="rounded bg-zinc-800 px-1">http://127.0.0.1:11150</code> (REST{" "}
            <code>/api/*</code>, MCP <code>/mcp</code>)
          </li>
          <li>
            <strong>Frontend</strong>: this dashboard at{" "}
            <code className="rounded bg-zinc-800 px-1">http://127.0.0.1:11151</code>
          </li>
          <li>
            <strong>Training</strong>: jobs run as subprocesses in the Unsloth venv (never in the
            server process)
          </li>
          <li>
            <strong>State</strong>: SQLite + logs under{" "}
            <code className="rounded bg-zinc-800 px-1">data/</code>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Environment variables
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-zinc-500">
              <th className="py-1">Variable</th>
              <th className="py-1">Default</th>
              <th className="py-1">Purpose</th>
            </tr>
          </thead>
          <tbody className="text-xs text-zinc-400">
            <tr>
              <td className="py-1 font-mono">UNSLOTH_PYTHON</td>
              <td className="py-1 font-mono">~/.unsloth/studio/.../python.exe</td>
              <td className="py-1">Unsloth venv interpreter</td>
            </tr>
            <tr>
              <td className="py-1 font-mono">UNSLOTH_MCP_DATA</td>
              <td className="py-1 font-mono">./data</td>
              <td className="py-1">jobs/models/datasets/db</td>
            </tr>
            <tr>
              <td className="py-1 font-mono">UNSLOTH_VRAM_GUARD</td>
              <td className="py-1 font-mono">0.85</td>
              <td className="py-1">busy threshold before refuse</td>
            </tr>
            <tr>
              <td className="py-1 font-mono">OLLAMA_URL</td>
              <td className="py-1 font-mono">http://127.0.0.1:11434</td>
              <td className="py-1">serving + chat proxy</td>
            </tr>
            <tr>
              <td className="py-1 font-mono">MCP_PORT / WEB_PORT</td>
              <td className="py-1 font-mono">11150</td>
              <td className="py-1">HTTP transport</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
