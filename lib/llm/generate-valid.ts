import { mapLlmError } from "./errors";
import { generatePageText } from "./generate";
import type { LlmConfig } from "./providers";
import { validateHtml } from "./validate";

export type GenerateValidResult =
  | { ok: true; html: string }
  | { ok: false; error: string; code?: string };

/**
 * Generate one page, validate it, and retry once with the validation error
 * appended. Provider failures are mapped to safe messages and not retried.
 */
export async function generateValidPage(input: {
  config: LlmConfig;
  system: string;
  prompt: string;
}): Promise<GenerateValidResult> {
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      attempt === 0
        ? input.prompt
        : `${input.prompt}\n\nYour previous response failed validation: ${lastError}\nReturn ONLY the corrected complete HTML document.`;

    try {
      const text = await generatePageText({
        config: input.config,
        system: input.system,
        prompt,
      });
      const validated = validateHtml(text);
      if (validated.ok) return { ok: true, html: validated.html };
      lastError = validated.error;
    } catch (error) {
      const info = mapLlmError(error);
      return { ok: false, error: info.message, code: info.code };
    }
  }

  return {
    ok: false,
    error: `The model did not return a valid page after a retry: ${lastError}`,
    code: "invalid_output",
  };
}
