"use client";

import {
  LLM_HEADERS,
  PROVIDERS,
  type ProviderId,
} from "./llm/catalog";
import {
  hasApiKey,
  loadSettings,
  type LlmSettings,
} from "./settings";

/** Thrown before a request is made when no key is saved in this browser. */
export class MissingLlmSettingsError extends Error {
  constructor() {
    super(
      "No LLM API key saved. Open Settings and add your provider API key before generating mocks.",
    );
    this.name = "MissingLlmSettingsError";
  }
}

export function llmHeaders(
  settings: LlmSettings | null | undefined,
): Record<string, string> {
  if (!settings || !hasApiKey(settings)) throw new MissingLlmSettingsError();
  const provider: ProviderId = settings.provider;
  return {
    [LLM_HEADERS.apiKey]: settings.apiKey.trim(),
    [LLM_HEADERS.provider]: provider,
    [LLM_HEADERS.model]:
      settings.model.trim() || PROVIDERS[provider].defaultModel,
  };
}

/**
 * fetch wrapper for LLM-backed endpoints. Attaches the saved BYOK credentials
 * from localStorage as headers; blocks the request when no key is saved.
 */
export async function llmFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  settings: LlmSettings | null = loadSettings(),
): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(llmHeaders(settings))) {
    headers.set(name, value);
  }
  return fetch(input, { ...init, headers });
}
