import { getDatabase } from "@/lib/db/client";
import {
  clearShareSlug,
  getProject,
  getProjectByShareSlug,
  setShareSlug,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";
import { appBaseUrl, generateShareSlug } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Create (or return the existing) public share link for a project. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDatabase();
    const project = getProject(db, id);
    if (!project) return json({ error: "Project not found." }, 404);

    let slug = project.shareSlug;
    if (!slug) {
      // Collisions are vanishingly unlikely, but retry a few times just in case.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateShareSlug();
        if (!getProjectByShareSlug(db, candidate)) {
          slug = candidate;
          break;
        }
      }
      if (!slug) {
        return json({ error: "Could not create a share link. Try again." }, 500);
      }
      setShareSlug(db, id, slug);
    }

    return json({ slug, url: `${appBaseUrl(request)}/p/${slug}` });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Revoke sharing: the existing URL stops resolving immediately. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDatabase();
    if (!getProject(db, id)) {
      return json({ error: "Project not found." }, 404);
    }
    clearShareSlug(db, id);
    return json({ revoked: true });
  } catch (error) {
    return errorResponse(error);
  }
}
