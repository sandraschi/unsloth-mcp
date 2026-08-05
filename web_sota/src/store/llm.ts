import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LLMProvider {
  name: string;
  port: number;
  detected: boolean;
  models: string[];
}

interface LLMState {
  providers: LLMProvider[];
  providerStatus: Record<string, "probing" | "detected" | "not_found">;
  selectedProvider: string;
  selectedModel: string;
  availableModels: string[];
  setProviders: (providers: LLMProvider[]) => void;
  setSelectedProvider: (name: string) => void;
  setSelectedModel: (model: string) => void;
  setAvailableModels: (models: string[]) => void;
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set) => ({
      providers: [],
      providerStatus: {},
      selectedProvider: "ollama",
      selectedModel: "",
      availableModels: [],
      setProviders: (providers) =>
        set(() => {
          const status: Record<string, "detected" | "not_found"> = {};
          for (const p of providers) status[p.name] = p.detected ? "detected" : "not_found";
          const available = providers.filter((p) => p.detected);
          const first = available[0]?.name ?? "ollama";
          return { providers, providerStatus: status, selectedProvider: first };
        }),
      setSelectedProvider: (name) => set({ selectedProvider: name }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setAvailableModels: (models) => set({ availableModels: models }),
    }),
    { name: "unsloth-mcp-llm" },
  ),
);
