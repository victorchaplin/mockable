import { getDatabase } from "@/lib/db/client";
import {
  createPage,
  findPageByName,
  getEntryPage,
  getProject,
  listPages,
  titleFromPageName,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";
import { generateValidPage } from "@/lib/llm/generate-valid";
import { registryFromPages } from "@/lib/llm/intent";
import { buildNewPagePrompt } from "@/lib/llm/prompts";
import { parseLlmHeaders } from "@/lib/llm/providers";
import { toPageDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Add a new page to the flow with the project's layout/style as context. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const config = parseLlmHeaders(request.headers);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      description?: unknown;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return json({ error: "Give the new page a name." }, 400);
    }
    const name = body.name;
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const db = getDatabase();
    const project = getProject(db, id);
    if (!project) return json({ error: "Project not found." }, 404);

    if (findPageByName(db, id, name)) {
      return json({ error: "A page with that name already exists." }, 409);
    }

    const pages = listPages(db, id);
    const entry = getEntryPage(db, id) ?? pages[0];
    const built = buildNewPagePrompt({
      archetype: project.archetype,
      pages: registryFromPages(pages),
      entryHtml: entry?.html ?? "",
      name,
      description,
    });

    const generated = await generateValidPage({
      config,
      system: built.system,
      prompt: built.prompt,
    });
    if (!generated.ok) {
      return json({ error: generated.error, code: generated.code }, 502);
    }

    const page = createPage(db, {
      projectId: id,
      name,
      title: titleFromPageName(name),
      html: generated.html,
    });

    return json({ page: toPageDTO(page) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
