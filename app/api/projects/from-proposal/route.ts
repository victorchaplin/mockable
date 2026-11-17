import { getDatabase } from "@/lib/db/client";
import {
  createProjectFromProposal,
  getProposal,
} from "@/lib/db/queries";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      proposalId?: string;
      name?: string;
    };

    if (!body.proposalId) {
      return json({ error: "Pick a proposal first." }, 400);
    }

    const db = getDatabase();
    if (!getProposal(db, body.proposalId)) {
      return json({ error: "That proposal no longer exists." }, 404);
    }

    const { project, page } = createProjectFromProposal(db, {
      proposalId: body.proposalId,
      name: body.name,
    });

    return json(
      {
        projectId: project.id,
        pageId: page.id,
        name: project.name,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
