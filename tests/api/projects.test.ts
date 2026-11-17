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

import { DELETE, PATCH } from "@/app/api/projects/[id]/route";
import { GET } from "@/app/api/projects/route";
import { createDatabase } from "@/lib/db/client";
import {
  createPage,
  createProject,
  getProject,
  getProjectByShareSlug,
  listPages,
  setShareSlug,
} from "@/lib/db/queries";

const HTML =
  '<!DOCTYPE html><html><body><h1>Page</h1><a href="page://settings">S</a></body></html>';

let projectId: string;

function context(id = projectId) {
  return { params: Promise.resolve({ id }) };
}

function request(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/projects/${projectId}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  state.db = createDatabase(":memory:");
  const project = createProject(state.db, {
    name: "Original name",
    prompt: "A prompt",
    archetype: "sidebar-shell",
  });
  projectId = project.id;
  createPage(state.db, {
    projectId,
    name: "home",
    title: "Home",
    html: HTML,
    isEntry: true,
  });
});

describe("GET /api/projects", () => {
  it("lists projects with counts and share state", async () => {
    setShareSlug(state.db!, projectId, "slug-1");
    const response = await GET();
    const body = await response.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      id: projectId,
      name: "Original name",
      pageCount: 1,
      shareSlug: "slug-1",
    });
  });
});

describe("PATCH /api/projects/:id", () => {
  it("renames the project", async () => {
    const response = await PATCH(
      request("PATCH", { name: "  New name  " }),
      context(),
    );
    expect(response.status).toBe(200);
    expect(getProject(state.db!, projectId)!.name).toBe("New name");
  });

  it("rejects blank names and unknown projects", async () => {
    expect((await PATCH(request("PATCH", { name: "   " }), context())).status).toBe(
      400,
    );
    expect(
      (await PATCH(request("PATCH", { name: "X" }), context("missing"))).status,
    ).toBe(404);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes pages and revokes the share link", async () => {
    setShareSlug(state.db!, projectId, "will-be-gone");

    const response = await DELETE(request("DELETE"), context());
    expect(response.status).toBe(200);

    expect(getProject(state.db!, projectId)).toBeUndefined();
    expect(listPages(state.db!, projectId)).toHaveLength(0);
    expect(getProjectByShareSlug(state.db!, "will-be-gone")).toBeUndefined();
  });

  it("404s for unknown projects", async () => {
    expect((await DELETE(request("DELETE"), context("missing"))).status).toBe(404);
  });
});
