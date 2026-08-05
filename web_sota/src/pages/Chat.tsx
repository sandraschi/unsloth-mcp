import { Download, Eraser, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/ui";
import { useLLMStore } from "../store/llm";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

const HISTORY_KEY = "unsloth-mcp-chat-history";
const PERSONALITY_KEY = "unsloth-mcp-chat-personality";

const PERSONALITIES: Record<string, { label: string; prompt: string }> = {
  "research-assistant": {
    label: "Research Assistant",
    prompt:
      "You are a precise research assistant specialized in LLM fine-tuning with Unsloth. Answer concisely; suggest concrete tool calls (unsloth_ops operations) when relevant.",
  },
  "expert-reviewer": {
    label: "Expert Reviewer",
    prompt:
      "You are a senior ML engineer reviewing training plans critically. Flag VRAM risks, overfitting, dataset issues, and suggest concrete hyperparameters.",
  },
  "quick-summarizer": {
    label: "Quick Summarizer",
    prompt: "You summarize training logs, errors, and job output in 3-5 tight bullets. No filler.",
  },
  custom: {
    label: "Custom",
    prompt: "",
  },
};

const EXAMPLE_PROMPTS = [
  {
    group: "Operations",
    prompts: [
      "What does my GPU look like right now?",
      "List all training jobs",
      "Show me the system readiness",
    ],
  },
  {
    group: "Training",
    prompts: [
      "How do I fine-tune Gemma 4 E2B on my notes?",
      "What batch size fits a 14B model on 24 GB?",
      "How do I export to GGUF and use it in Ollama?",
    ],
  },
  {
    group: "Troubleshooting",
    prompts: [
      "Why would a job stay queued?",
      "What does OOM mean and how do I fix it?",
      "How do I register a trained model in Ollama?",
    ],
  },
];

export default function Chat() {
  const { providers, selectedProvider, selectedModel, setProviders, setSelectedModel } =
    useLLMStore();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [personality, setPersonality] = useState(
    () => localStorage.getItem(PERSONALITY_KEY) || "research-assistant",
  );
  const [customPrompt, setCustomPrompt] = useState(
    () => localStorage.getItem(`${PERSONALITY_KEY}-custom`) || "",
  );
  const [skillText, setSkillText] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ providers: typeof providers }>("/api/llm/discover")
      .then((r) => {
        setProviders(r.providers);
        const first = r.providers.find((p) => p.detected);
        if (first) {
          setSelectedModel(first.models[0] ?? "");
        }
      })
      .catch(() => {});
    api
      .get<{ skills: { name: string }[] }>("/api/skills")
      .then(async (r) => {
        if (r.skills.length) {
          const c = await api.get<{ content: string }>(`/api/skills/${r.skills[0].name}`);
          setSkillText(c.content);
        }
      })
      .catch(() => {});
  }, [setProviders, setSelectedModel]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-100)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildSystem = () => {
    const skill =
      skillText ||
      "You are controlling unsloth-mcp, a local LLM fine-tuning server. Tools: unsloth_ops (system, train, jobs_list, jobs_status, jobs_cancel, jobs_export, jobs_register_ollama, models_list, datasets_list).";
    if (personality === "custom") return customPrompt || skill;
    return `${skill}\n\n---\n\n## Role\n${PERSONALITIES[personality].prompt}`;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history: Msg[] = [
      ...messages,
      { role: "user", content: text, ts: new Date().toISOString() },
    ];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const r = await api.post<{ content: string; model?: string }>("/api/llm/chat", {
        messages: [
          { role: "system", content: buildSystem() },
          ...history.map(({ role, content }) => ({ role, content })),
        ],
        model: selectedModel || undefined,
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.content, ts: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(`Chat failed (Ollama reachable?): ${e}`);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e}`, ts: new Date().toISOString() },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const exportTxt = () => {
    const lines = messages.map((m) => `[${m.ts ?? ""}] ${m.role}: ${m.content}`);
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `unsloth-mcp-chat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const provider = providers.find((p) => p.name === selectedProvider);
  const detected = Boolean(provider?.detected);

  return (
    <div data-testid="chat-page" className="flex h-full flex-col">
      <PageHeader
        title="Chat"
        subtitle="Ask about fine-tuning with the skill preprompt loaded"
        extra={
          <div className="flex items-center gap-2" data-testid="chat-controls">
            <select
              data-testid="personality-select"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs"
              value={personality}
              onChange={(e) => {
                setPersonality(e.target.value);
                localStorage.setItem(PERSONALITY_KEY, e.target.value);
              }}
            >
              {Object.entries(PERSONALITIES).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
            {personality === "custom" && (
              <input
                className="w-56 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs"
                placeholder="Custom system prompt"
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  localStorage.setItem(`${PERSONALITY_KEY}-custom`, e.target.value);
                }}
              />
            )}
            <button
              onClick={exportTxt}
              data-testid="chat-export"
              disabled={!messages.length}
              className="rounded-lg border border-zinc-700 p-1.5 hover:bg-zinc-800 disabled:opacity-40"
              title="Export .txt"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={clear}
              data-testid="chat-clear"
              disabled={!messages.length}
              className="rounded-lg border border-zinc-700 p-1.5 hover:bg-zinc-800 disabled:opacity-40"
              title="Clear conversation"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <span className={`text-xs ${detected ? "text-green-400" : "text-red-400"}`}>
              {detected
                ? `${provider?.name ?? "ollama"} on :${provider?.port ?? 11434}`
                : "Ollama not detected"}
            </span>
          </div>
        }
      />

      {skillText && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          skill: unsloth-trainer loaded as base preprompt
        </div>
      )}

      {detected && (provider?.models.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Model:</span>
          <select
            data-testid="llm-model-select"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              localStorage.setItem("unsloth-mcp-llm-model", e.target.value);
            }}
          >
            {(provider?.models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      <div data-testid="chat-messages" className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-amber-500/15 text-amber-100"
                  : "bg-zinc-800/80 text-zinc-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-zinc-500">Thinking...</div>}
        {error && !busy && <div className="text-xs text-red-400">{error}</div>}
        {!messages.length && !busy && (
          <div data-testid="example-prompts" className="space-y-3">
            <div className="text-sm text-zinc-500">Try one of these:</div>
            {EXAMPLE_PROMPTS.map((g) => (
              <div key={g.group}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {g.group}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          data-testid="chat-input"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          placeholder={detected ? "Ask about fine-tuning..." : "Start Ollama to enable chat"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          disabled={!detected || busy}
        />
        <button
          onClick={send}
          data-testid="chat-send"
          disabled={!detected || busy || !input.trim()}
          className="rounded-lg bg-amber-500 px-4 text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
