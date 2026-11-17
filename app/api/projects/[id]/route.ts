import { getDatabase } from "@/lib/db/client";
import {
  deleteProject,
  getProject,
  listPages,
  renameProject,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Rename a project from the projects home. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return json({ error: "Give the project a name." }, 400);

    const db = getDatabase();
    if (!getProject(db, id)) {
      return json({ error: "Project not found." }, 404);
    }

    renameProject(db, id, name);
    return json({ project: { id, name } });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Delete a project. Pages cascade with the foreign key and the share slug
 * disappears with the row, so any public link is revoked as a side effect.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDatabase();
    if (!getProject(db, id)) {
      return json({ error: "Project not found." }, 404);
    }

    deleteProject(db, id);
    return json({ deleted: true, remainingPages: listPages(db, id).length });
  } catch (error) {
    return errorResponse(error);
  }
}
