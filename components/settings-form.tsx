"use client";

import { useEffect, useState } from "react";
import { PROVIDER_LIST, PROVIDERS } from "@/lib/llm/catalog";
import {
  clearSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  type LlmSettings,
} from "@/lib/settings";

export function SettingsForm() {
  const [settings, setSettings] = useState<LlmSettings>(defaultSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = loadSettings();
    if (stored) setSettings(stored);
    setLoaded(true);
  }, []);

  function update<K extends keyof LlmSettings>(key: K, value: LlmSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatus(null);
  }

  function handleProviderChange(provider: string) {
    const next = PROVIDER_LIST.find((entry) => entry.id === provider);
    if (!next) return;
    setSettings((current) => ({
      ...current,
      provider: next.id,
      model:
        current.model === PROVIDERS[current.provider].defaultModel ||
        !current.model.trim()
          ? next.defaultModel
          : current.model,
    }));
    setStatus(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings(settings);
    setStatus("Settings saved in this browser.");
  }

  function handleClear() {
    clearSettings();
    setSettings(defaultSettings());
    setStatus("Settings cleared from this browser.");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-5"
      aria-label="LLM settings"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="llm-provider" className="text-sm font-medium">
          Provider
        </label>
        <select
          id="llm-provider"
          value={settings.provider}
          onChange={(event) => handleProviderChange(event.target.value)}
          disabled={!loaded}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
        >
          {PROVIDER_LIST.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="llm-model" className="text-sm font-medium">
          Model
        </label>
        <input
          id="llm-model"
          value={settings.model}
          onChange={(event) => update("model", event.target.value)}
          placeholder={PROVIDERS[settings.provider].defaultModel}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="llm-api-key" className="text-sm font-medium">
          API key
        </label>
        <input
          id="llm-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={settings.apiKey}
          onChange={(event) => update("apiKey", event.target.value)}
          placeholder={PROVIDERS[settings.provider].keyHint}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm shadow-sm outline-none focus:border-slate-900"
        />
        <p className="text-xs text-slate-500">
          Stored in this browser only (localStorage). The server never stores or
          logs your key; it is sent per request to your chosen provider.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save settings
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Clear
        </button>
        {status ? (
          <span role="status" className="text-sm text-emerald-700">
            {status}
          </span>
        ) : null}
      </div>
    </form>
  );
}
