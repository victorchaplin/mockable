/**
 * Map provider/LLM failures onto safe, actionable user-facing messages.
 * Key-related failures always point the user at Settings. Raw provider text is
 * never returned, and secrets are redacted from anything we do log.
 */

export type LlmErrorCode =
  | "invalid_key"
  | "expired_key"
  | "quota"
  | "rate_limit"
  | "invalid_output"
  | "unknown";

export type LlmErrorInfo = {
  code: LlmErrorCode;
  message: string;
};

const SETTINGS_HINT = "Open Settings to update your LLM key.";

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === "number") return record.statusCode;
  if (typeof record.status === "number") return record.status;
  return undefined;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const data = record.data as Record<string, unknown> | undefined;
    if (data && typeof data.message === "string") return data.message;
    if (typeof record.message === "string") return record.message;
  }
  return "";
}

export function mapLlmError(error: unknown): LlmErrorInfo {
  const status = statusOf(error);
  const text = messageOf(error);
  const lowered = text.toLowerCase();

  if (
    /quota|insufficient_quota|billing|credit balance|payment required/.test(
      lowered,
    ) ||
    status === 402
  ) {
    return {
      code: "quota",
      message: `Your LLM account is out of quota. Add credit with your provider or switch keys. ${SETTINGS_HINT}`,
    };
  }

  if (/expired/.test(lowered)) {
    return {
      code: "expired_key",
      message: `Your LLM API key has expired. ${SETTINGS_HINT}`,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /invalid.*api.?key|incorrect api.?key|unauthorized|authentication/.test(
      lowered,
    )
  ) {
    return {
      code: "invalid_key",
      message: `Your LLM API key was rejected. ${SETTINGS_HINT}`,
    };
  }

  if (
    status === 429 ||
    /rate limit|too many requests|overloaded/.test(lowered)
  ) {
    return {
      code: "rate_limit",
      message:
        "The LLM provider is rate limiting requests. Wait a moment and try again.",
    };
  }

  return {
    code: "unknown",
    message:
      "The LLM request failed. Check your provider, model, and API key in Settings and try again.",
  };
}

/** Replace every occurrence of the given secrets in a string. */
export function redactSecrets(
  text: string,
  secrets: Array<string | null | undefined>,
): string {
  let output = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    output = output.split(secret).join("[redacted]");
  }
  return output;
}

/** Build a log-safe error shape; never includes request headers or bodies. */
export function safeErrorForLog(
  error: unknown,
  secrets: Array<string | null | undefined> = [],
): { name: string; message: string } {
  const name = error instanceof Error ? error.name : "Error";
  const message = redactSecrets(messageOf(error), secrets);
  return { name, message };
}
