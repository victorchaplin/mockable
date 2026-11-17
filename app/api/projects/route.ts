import { getDatabase } from "@/lib/db/client";
import { listProjects } from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDatabase();
    const projects = listProjects(db).map((project) => ({
      id: project.id,
      name: project.name,
      archetype: project.archetype,
      shareSlug: project.shareSlug,
      pageCount: project.pageCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
    return json({ projects });
  } catch (error) {
    return errorResponse(error);
  }
}
