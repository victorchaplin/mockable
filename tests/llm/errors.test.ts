import { describe, expect, it } from "vitest";
import {
  mapLlmError,
  redactSecrets,
  safeErrorForLog,
} from "@/lib/llm/errors";

describe("mapLlmError", () => {
  it("maps invalid keys to a settings-pointing message", () => {
    const info = mapLlmError(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );
    expect(info.code).toBe("invalid_key");
    expect(info.message).toMatch(/key/i);
    expect(info.message).toMatch(/Settings/);
  });

  it("maps expired keys", () => {
    const info = mapLlmError(new Error("This API key has expired"));
    expect(info.code).toBe("expired_key");
    expect(info.message).toMatch(/expired/i);
    expect(info.message).toMatch(/Settings/);
  });

  it("maps quota errors from the provider", () => {
    const info = mapLlmError(
      Object.assign(new Error("insufficient_quota: billing hard limit"), {
        statusCode: 429,
      }),
    );
    expect(info.code).toBe("quota");
    expect(info.message).toMatch(/quota/i);
    expect(info.message).toMatch(/Settings/);
  });

  it("maps rate limits separately from quota", () => {
    const info = mapLlmError(
      Object.assign(new Error("Too many requests"), { statusCode: 429 }),
    );
    expect(info.code).toBe("rate_limit");
    expect(info.message).toMatch(/wait/i);
  });

  it("maps unknown failures to safe guidance", () => {
    const info = mapLlmError(new Error("socket hang up"));
    expect(info.code).toBe("unknown");
    expect(info.message).toMatch(/Settings/);
  });

  it("never echoes provider text that contains the key", () => {
    const secret = "sk-live-super-secret";
    const info = mapLlmError(
      Object.assign(
        new Error(`Incorrect API key provided: ${secret}`),
        { statusCode: 401 },
      ),
    );
    expect(JSON.stringify(info)).not.toContain(secret);
  });
});

describe("redaction", () => {
  it("replaces every secret occurrence", () => {
    expect(
      redactSecrets("key=abc123 and again abc123", ["abc123", undefined, ""]),
    ).toBe("key=[redacted] and again [redacted]");
  });

  it("produces log-safe errors without secrets", () => {
    const secret = "sk-secret-in-error";
    const safe = safeErrorForLog(new Error(`bad ${secret}`), [secret]);
    expect(safe.message).not.toContain(secret);
    expect(safe.message).toContain("[redacted]");
  });
});
