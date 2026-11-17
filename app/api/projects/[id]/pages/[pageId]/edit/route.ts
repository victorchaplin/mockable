import { getDatabase, type Db } from "@/lib/db/client";
import {
  createPage,
  getEntryPage,
  getPage,
  getProject,
  listPages,
  titleFromPageName,
  updatePage,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";
import { generateValidPage } from "@/lib/llm/generate-valid";
import {
  detectNewPageRequest,
  registryFromPages,
} from "@/lib/llm/intent";
import { buildNewPagePrompt, buildRefinePrompt } from "@/lib/llm/prompts";
import {
  parseLlmHeaders,
  type LlmConfig,
} from "@/lib/llm/providers";
import { encodeSse } from "@/lib/sse";
import { toPageDTO, type EditorEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function streamWork(
  work: (send: (event: EditorEvent) => void) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: EditorEvent) =>
        controller.enqueue(encoder.encode(encodeSse(event)));
      try {
        await work(send);
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "The request failed. Try again.",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

async function createPageFromRequest(input: {
  db: Db;
  config: LlmConfig;
  projectId: string;
  projectArchetype: string;
  name: string;
  description: string;
  entryHtml: string;
  send: (event: EditorEvent) => void;
}): Promise<void> {
  const pages = listPages(input.db, input.projectId);
  const built = buildNewPagePrompt({
    archetype: input.projectArchetype,
    pages: registryFromPages(pages),
    entryHtml: input.entryHtml,
    name: input.name,
    description: input.description,
  });

  const generated = await generateValidPage({
    config: input.config,
    system: built.system,
    prompt: built.prompt,
  });

  if (!generated.ok) {
    input.send({ type: "error", error: generated.error });
    return;
  }

  const page = createPage(input.db, {
    projectId: input.projectId,
    name: input.name,
    title: titleFromPageName(input.name),
    html: generated.html,
  });
  input.send({ type: "page_created", page: toPageDTO(page) });
}

/**
 * Chat refinement. Streams progress and a final full-page replacement (design
 * D5: the model rewrites the entire page; live token streaming into the
 * preview is a post-MVP polish).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const config = parseLlmHeaders(request.headers);
    const { id, pageId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
    };
    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return json({ error: "Type a refinement request first." }, 400);
    }

    const db = getDatabase();
    const project = getProject(db, id);
    if (!project) return json({ error: "Project not found." }, 404);
    const page = getPage(db, id, pageId);
    if (!page) return json({ error: "Page not found." }, 404);

    const pages = listPages(db, id);
    const entry = getEntryPage(db, id) ?? page;

    // A clear "add a settings page" request grows the flow instead of editing
    // the current page (spec: new page requested in chat).
    const intent = detectNewPageRequest(message);
    const nameTaken =
      intent !== null && pages.some((existing) => existing.name === intent.name);

    if (intent && !nameTaken) {
      return streamWork(async (send) => {
        send({
          type: "status",
          message: `Creating the "${intent.name}" page…`,
        });
        await createPageFromRequest({
          db,
          config,
          projectId: id,
          projectArchetype: project.archetype,
          name: intent.name,
          description: intent.description,
          entryHtml: entry.html,
          send,
        });
        send({ type: "done" });
      });
    }

    const built = buildRefinePrompt({
      archetype: project.archetype,
      pages: registryFromPages(pages),
      currentPageName: page.name,
      currentHtml: page.html,
      message,
    });

    return streamWork(async (send) => {
      send({ type: "status", message: "Rewriting the page…" });

      const generated = await generateValidPage({
        config,
        system: built.system,
        prompt: built.prompt,
      });

      if (!generated.ok) {
        send({ type: "error", error: generated.error });
        return;
      }

      const updated = updatePage(db, id, pageId, { html: generated.html });
      send({ type: "page", page: toPageDTO(updated) });
      send({ type: "done" });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
