import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  DEFAULT_PROVIDER_ID,
  LLM_HEADERS,
  PROVIDERS,
  isProviderId,
  type ProviderId,
} from "./catalog";

export { LLM_HEADERS };

export type LlmConfig = {
  provider: ProviderId;
  model: string;
  apiKey: string;
};

export type LlmConfigErrorCode =
  | "missing_key"
  | "unknown_provider";

export class LlmConfigError extends Error {
  code: LlmConfigErrorCode;

  constructor(code: LlmConfigErrorCode, message: string) {
    super(message);
    this.name = "LlmConfigError";
    this.code = code;
  }
}

/**
 * Read the per-request BYOK credentials from headers.
 * Error messages are safe to show to users and never include the key.
 */
export function parseLlmHeaders(headers: Headers): LlmConfig {
  const rawProvider = headers.get(LLM_HEADERS.provider)?.trim() || DEFAULT_PROVIDER_ID;
  const apiKey = headers.get(LLM_HEADERS.apiKey)?.trim() ?? "";
  const modelHeader = headers.get(LLM_HEADERS.model)?.trim() ?? "";

  if (!isProviderId(rawProvider)) {
    throw new LlmConfigError(
      "unknown_provider",
      `Unknown LLM provider "${rawProvider}". Open Settings and choose one of: ${Object.values(
        PROVIDERS,
      )
        .map((provider) => provider.id)
        .join(", ")}.`,
    );
  }

  if (!apiKey) {
    throw new LlmConfigError(
      "missing_key",
      "No LLM API key provided. Open Settings and add your provider API key.",
    );
  }

  return {
    provider: rawProvider,
    model: modelHeader || PROVIDERS[rawProvider].defaultModel,
    apiKey,
  };
}

/**
 * Build a provider instance for one request. Provider ids are code, not config;
 * adding a provider is a code change (design D3).
 */
export function buildLanguageModel(config: LlmConfig): LanguageModel {
  const { provider, model, apiKey } = config;
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "zai":
      return createOpenAICompatible({
        name: "zai",
        apiKey,
        baseURL: "https://api.z.ai/api/paas/v4",
      })(model);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(model);
    default: {
      const exhaustive: never = provider;
      throw new LlmConfigError(
        "unknown_provider",
        `Unknown LLM provider "${String(exhaustive)}". Open Settings and choose a supported provider.`,
      );
    }
  }
}
