"use client";

import {
  DEFAULT_PROVIDER_ID,
  PROVIDERS,
  isProviderId,
  type ProviderId,
} from "./llm/catalog";

/**
 * BYOK settings live in the browser only (design D3). Nothing here ever talks
 * to the server except as per-request headers added by `lib/llm-client.ts`.
 */

export type LlmSettings = {
  provider: ProviderId;
  model: string;
  apiKey: string;
};

export const SETTINGS_STORAGE_KEY = "mockable:llm-settings";

export function defaultSettings(): LlmSettings {
  const envProvider = process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER;
  const provider: ProviderId = isProviderId(envProvider)
    ? envProvider
    : DEFAULT_PROVIDER_ID;
  const envModel = process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL;
  return {
    provider,
    model: envModel || PROVIDERS[provider].defaultModel,
    apiKey: "",
  };
}

/** Read saved settings; returns null when nothing valid is stored. */
export function loadSettings(): LlmSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    if (typeof parsed !== "object" || parsed === null) return null;
    const fallback = defaultSettings();
    const provider = isProviderId(parsed.provider)
      ? parsed.provider
      : fallback.provider;
    return {
      provider,
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model
          : PROVIDERS[provider].defaultModel,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    };
  } catch {
    return null;
  }
}

export function saveSettings(settings: LlmSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      provider: settings.provider,
      model: settings.model.trim() || PROVIDERS[settings.provider].defaultModel,
      apiKey: settings.apiKey.trim(),
    }),
  );
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
}

export function hasApiKey(settings: LlmSettings | null): boolean {
  return Boolean(settings?.apiKey?.trim());
}
