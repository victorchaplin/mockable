import { DuplicatePageNameError } from "./db/queries";
import { mapLlmError } from "./llm/errors";
import { LlmConfigError } from "./llm/providers";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Error -> safe JSON response. Never includes request headers or bodies. */
export function errorResponse(error: unknown): Response {
  if (error instanceof LlmConfigError) {
    return json({ error: error.message, code: error.code }, 400);
  }
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof DuplicatePageNameError) {
    return json({ error: error.message, code: "duplicate_page_name" }, 409);
  }
  console.error(
    "[mockable] request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    { error: "Something went wrong completing that request. Please try again." },
    500,
  );
}

/** Map a provider/LLM failure onto a safe message pointing at Settings. */
export function llmFailureResponse(error: unknown): Response {
  const info = mapLlmError(error);
  return json({ error: info.message, code: info.code }, 502);
}
