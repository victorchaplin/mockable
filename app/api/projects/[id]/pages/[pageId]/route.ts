import { getDatabase } from "@/lib/db/client";
import { getPage, updatePage } from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";
import { validateHtml } from "@/lib/llm/validate";
import { toPageDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

/** Manual HTML/CSS edit from the code panel. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, pageId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      html?: unknown;
      title?: unknown;
    };

    if (typeof body.html !== "string" && typeof body.title !== "string") {
      return json({ error: "Nothing to save." }, 400);
    }

    let html: string | undefined;
    if (typeof body.html === "string") {
      const validated = validateHtml(body.html);
      if (!validated.ok) {
        return json({ error: validated.error, code: "invalid_html" }, 422);
      }
      html = validated.html;
    }

    const db = getDatabase();
    if (!getPage(db, id, pageId)) {
      return json({ error: "Page not found." }, 404);
    }

    const page = updatePage(db, id, pageId, {
      html,
      title: typeof body.title === "string" ? body.title : undefined,
    });

    return json({ page: toPageDTO(page) });
  } catch (error) {
    return errorResponse(error);
  }
}
