import { generateText } from "ai";
import { buildLanguageModel, type LlmConfig } from "./providers";
import { isMockLlmEnabled, mockGenerateText } from "./mock";

export type GeneratePageInput = {
  config: LlmConfig;
  system: string;
  prompt: string;
  temperature?: number;
};

/**
 * Single server-side chokepoint for LLM text generation. Route handlers call
 * this; tests mock this module. The provider instance is built per request
 * from the BYOK headers and never cached.
 */
export async function generatePageText(
  input: GeneratePageInput,
): Promise<string> {
  if (isMockLlmEnabled()) {
    return mockGenerateText({ system: input.system, prompt: input.prompt });
  }

  const model = buildLanguageModel(input.config);
  const result = await generateText({
    model,
    system: input.system,
    prompt: input.prompt,
    temperature: input.temperature ?? 0.8,
  });
  return result.text;
}
