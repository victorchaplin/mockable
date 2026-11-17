import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";

const state = vi.hoisted(() => ({ db: null as Db | null }));

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    getDatabase: () => {
      if (!state.db) throw new Error("test db not initialised");
      return state.db;
    },
  };
});

import { POST } from "@/app/api/projects/from-proposal/route";
import { createDatabase } from "@/lib/db/client";
import {
  createGeneration,
  createProposal,
  getProject,
  listPages,
  listProposals,
} from "@/lib/db/queries";

const HTML =
  '<!DOCTYPE html><html><body><h1>Picked</h1><a href="page://settings">Settings</a></body></html>';

function request(body: unknown): Request {
  return new Request("http://localhost/api/projects/from-proposal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.db = createDatabase(":memory:");
});

describe("POST /api/projects/from-proposal", () => {
  it("creates a project with an entry page and marks the proposal picked", async () => {
    const db = state.db!;
    const generation = createGeneration(db, "A meal planner for busy families");
    const proposal = createProposal(db, {
      generationId: generation.id,
      variantIndex: 2,
      archetype: "top-nav-cards",
      html: HTML,
    });

    const response = await POST(request({ proposalId: proposal.id }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.projectId).toBeTruthy();

    const project = getProject(db, body.projectId)!;
    expect(project.name).toBe("A meal planner for busy families");
    expect(project.archetype).toBe("top-nav-cards");
    expect(project.prompt).toBe("A meal planner for busy families");

    const pages = listPages(db, project.id);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      name: "home",
      isEntry: true,
      html: HTML,
    });

    expect(listProposals(db, generation.id)[0].pickedAt).not.toBeNull();
    expect(body.pageId).toBe(pages[0].id);
  });

  it("accepts an explicit project name", async () => {
    const db = state.db!;
    const generation = createGeneration(db, "A prompt");
    const proposal = createProposal(db, {
      generationId: generation.id,
      variantIndex: 1,
      archetype: "sidebar-shell",
      html: HTML,
    });

    const response = await POST(
      request({ proposalId: proposal.id, name: "Renamed project" }),
    );
    const body = await response.json();
    expect(getProject(db, body.projectId)!.name).toBe("Renamed project");
  });

  it("rejects missing and unknown proposals", async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ proposalId: "nope" }))).status).toBe(404);
  });
});
