/**
 * Provider catalog shared by the Settings UI and the server-side registry.
 * Kept free of SDK imports so client components can use it.
 */

export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "zai",
  "openrouter",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  keyHint: string;
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o",
    keyHint: "sk-...",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-5",
    keyHint: "sk-ant-...",
  },
  google: {
    id: "google",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyHint: "AIza...",
  },
  zai: {
    id: "zai",
    label: "Z.ai",
    defaultModel: "glm-4.6",
    keyHint: "your Z.ai key",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    keyHint: "sk-or-...",
  },
};

export const PROVIDER_LIST: ProviderInfo[] = PROVIDER_IDS.map(
  (id) => PROVIDERS[id],
);

export const DEFAULT_PROVIDER_ID: ProviderId = "openai";

export function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    (PROVIDER_IDS as readonly string[]).includes(value)
  );
}

export function providerLabel(id: string): string {
  return isProviderId(id) ? PROVIDERS[id].label : id;
}

/** Header names used by every LLM-bound request (design D3). */
export const LLM_HEADERS = {
  apiKey: "x-llm-api-key",
  provider: "x-llm-provider",
  model: "x-llm-model",
} as const;
