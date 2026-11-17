import { getDatabase } from "@/lib/db/client";
import {
  createGeneration,
  createProposal,
  getGeneration,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";
import { mapLlmError } from "@/lib/llm/errors";
import { generatePageText } from "@/lib/llm/generate";
import {
  LAYOUT_ARCHETYPES,
  buildProposalPrompt,
} from "@/lib/llm/prompts";
import { parseLlmHeaders, type LlmConfig } from "@/lib/llm/providers";
import { validateHtml } from "@/lib/llm/validate";
import { encodeSse } from "@/lib/sse";
import type { Db } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerationEvent =
  | { type: "generation"; generationId: string }
  | {
      type: "variant";
      variantIndex: number;
      archetype: string;
      proposalId: string;
      html: string;
    }
  | {
      type: "variant_error";
      variantIndex: number;
      archetype: string;
      error: string;
    }
  | { type: "done" };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

type VariantInput = {
  db: Db;
  config: LlmConfig;
  generationId: string;
  prompt: string;
  variantIndex: number;
  archetypeId: string;
};

async function generateVariantEvent(
  input: VariantInput,
): Promise<GenerationEvent> {
  const archetype =
    LAYOUT_ARCHETYPES.find((entry) => entry.id === input.archetypeId) ??
    LAYOUT_ARCHETYPES[0];

  const built = buildProposalPrompt({
    prompt: input.prompt,
    archetype: archetype.id,
  });

  let lastValidationError = "";

  // One automatic retry when the model returns invalid output (design D4).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      attempt === 0
        ? built.prompt
        : `${built.prompt}\n\nYour previous response failed validation: ${lastValidationError}\nReturn ONLY the corrected complete HTML document.`;

    try {
      const text = await generatePageText({
        config: input.config,
        system: built.system,
        prompt,
      });
      const validated = validateHtml(text);
      if (!validated.ok) {
        lastValidationError = validated.error;
        continue;
      }
      const proposal = createProposal(input.db, {
        generationId: input.generationId,
        variantIndex: input.variantIndex,
        archetype: archetype.id,
        html: validated.html,
      });
      return {
        type: "variant",
        variantIndex: input.variantIndex,
        archetype: archetype.id,
        proposalId: proposal.id,
        html: validated.html,
      };
    } catch (error) {
      // Provider failures are not retried; surface a safe message per variant.
      return {
        type: "variant_error",
        variantIndex: input.variantIndex,
        archetype: archetype.id,
        error: mapLlmError(error).message,
      };
    }
  }

  return {
    type: "variant_error",
    variantIndex: input.variantIndex,
    archetype: archetype.id,
    error: `The model did not return valid HTML after a retry: ${lastValidationError}`,
  };
}

export async function POST(request: Request) {
  try {
    const config = parseLlmHeaders(request.headers);
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      generationId?: string;
      variantIndex?: number;
    };

    const db = getDatabase();

    // Per-variant retry: regenerate a single failed card under an existing run.
    if (body.generationId && body.variantIndex) {
      const generation = getGeneration(db, body.generationId);
      if (!generation) return json({ error: "Generation not found." }, 404);
      const archetype = LAYOUT_ARCHETYPES[body.variantIndex - 1];
      if (!archetype) {
        return json({ error: "Unknown variant index." }, 400);
      }

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (event: GenerationEvent) =>
            controller.enqueue(encoder.encode(encodeSse(event)));
          try {
            send({ type: "generation", generationId: generation.id });
            send(
              await generateVariantEvent({
                db,
                config,
                generationId: generation.id,
                prompt: generation.prompt,
                variantIndex: body.variantIndex as number,
                archetypeId: archetype.id,
              }),
            );
            send({ type: "done" });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: SSE_HEADERS });
    }

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return json(
        { error: "Describe the app you want to mock, then try again." },
        400,
      );
    }

    const generation = createGeneration(db, prompt);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: GenerationEvent) =>
          controller.enqueue(encoder.encode(encodeSse(event)));

        try {
          send({ type: "generation", generationId: generation.id });

          // Five parallel, independent calls; one slow or failed variant never
          // blocks the others (design D4).
          await Promise.all(
            LAYOUT_ARCHETYPES.map(async (archetype, index) => {
              const event = await generateVariantEvent({
                db,
                config,
                generationId: generation.id,
                prompt,
                variantIndex: index + 1,
                archetypeId: archetype.id,
              });
              send(event);
            }),
          );

          send({ type: "done" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
