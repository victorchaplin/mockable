// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MissingLlmSettingsError,
  llmFetch,
  llmHeaders,
} from "@/lib/llm-client";
import {
  SETTINGS_STORAGE_KEY,
  saveSettings,
} from "@/lib/settings";
import { LlmSettingsNotice } from "@/components/llm-settings-notice";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("llmFetch", () => {
  it("attaches the saved BYOK headers to the request", async () => {
    saveSettings({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-browser-only",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await llmFetch("/api/generations", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("x-llm-api-key")).toBe("sk-browser-only");
    expect(headers.get("x-llm-provider")).toBe("openai");
    expect(headers.get("x-llm-model")).toBe("gpt-4o");
  });

  it("blocks the request and asks for settings when no key is saved", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(llmFetch("/api/generations")).rejects.toBeInstanceOf(
      MissingLlmSettingsError,
    );
    await expect(llmFetch("/api/generations")).rejects.toThrow(/Settings/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty key even when settings exist", () => {
    expect(() =>
      llmHeaders({ provider: "openai", model: "gpt-4o", apiKey: "   " }),
    ).toThrow(MissingLlmSettingsError);
  });

  it("never writes the key to localStorage keys other than the settings entry", async () => {
    saveSettings({
      provider: "google",
      model: "gemini-2.5-flash",
      apiKey: "AIza-secret",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    await llmFetch("/api/generations");

    const keys = Object.keys(window.localStorage);
    expect(keys).toEqual([SETTINGS_STORAGE_KEY]);
  });
});

describe("LlmSettingsNotice", () => {
  it("points the user at settings", () => {
    render(<LlmSettingsNotice />);
    const link = screen.getByRole("link", { name: "Open Settings" });
    expect(link).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("alert")).toHaveTextContent(/LLM key/i);
  });
});
