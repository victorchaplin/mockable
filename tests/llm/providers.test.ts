import { describe, expect, it } from "vitest";
import {
  LLM_HEADERS,
  LlmConfigError,
  buildLanguageModel,
  parseLlmHeaders,
} from "@/lib/llm/providers";
import { PROVIDER_IDS, PROVIDERS } from "@/lib/llm/catalog";

function headers(values: Record<string, string>): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

describe("parseLlmHeaders", () => {
  it("reads provider, model, and key from request headers", () => {
    const config = parseLlmHeaders(
      headers({
        [LLM_HEADERS.apiKey]: "sk-test-123",
        [LLM_HEADERS.provider]: "anthropic",
        [LLM_HEADERS.model]: "claude-sonnet-4-5",
      }),
    );
    expect(config).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-test-123",
    });
  });

  it("falls back to the provider's default model", () => {
    const config = parseLlmHeaders(
      headers({
        [LLM_HEADERS.apiKey]: "sk-test-123",
        [LLM_HEADERS.provider]: "openai",
      }),
    );
    expect(config.model).toBe(PROVIDERS.openai.defaultModel);
  });

  it("rejects a missing key without echoing any secret", () => {
    expect(() =>
      parseLlmHeaders(headers({ [LLM_HEADERS.provider]: "openai" })),
    ).toThrowError(LlmConfigError);
    try {
      parseLlmHeaders(
        headers({
          [LLM_HEADERS.provider]: "openai",
          [LLM_HEADERS.model]: "gpt-4o",
        }),
      );
    } catch (error) {
      const info = error as LlmConfigError;
      expect(info.code).toBe("missing_key");
      expect(info.message).toMatch(/Settings/);
      expect(info.message).not.toMatch(/sk-/);
    }
  });

  it("rejects an unknown provider and never includes the key in the error", () => {
    const secret = "sk-super-secret-key-value";
    try {
      parseLlmHeaders(
        headers({
          [LLM_HEADERS.provider]: "not-a-provider",
          [LLM_HEADERS.apiKey]: secret,
          [LLM_HEADERS.model]: "whatever",
        }),
      );
      throw new Error("expected parseLlmHeaders to throw");
    } catch (error) {
      const info = error as LlmConfigError;
      expect(info.code).toBe("unknown_provider");
      expect(info.message).not.toContain(secret);
      expect(info.message).toMatch(/Settings/);
    }
  });
});

describe("buildLanguageModel", () => {
  it.each(PROVIDER_IDS)("builds a model for %s", (provider) => {
    const model = buildLanguageModel({
      provider,
      model: PROVIDERS[provider].defaultModel,
      apiKey: "test-key",
    }) as unknown as { modelId?: string };
    expect(model).toBeTruthy();
    expect(model.modelId).toBe(PROVIDERS[provider].defaultModel);
  });

  it("throws safely for an unknown provider id", () => {
    const secret = "sk-never-log-me";
    try {
      buildLanguageModel({
        provider: "bogus" as never,
        model: "m",
        apiKey: secret,
      });
      throw new Error("expected buildLanguageModel to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toMatch(/Settings/);
    }
  });
});
