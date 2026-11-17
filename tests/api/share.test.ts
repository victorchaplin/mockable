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

import { DELETE, POST } from "@/app/api/projects/[id]/share/route";
import { createDatabase } from "@/lib/db/client";
import {
  createProject,
  getProject,
  getProjectByShareSlug,
} from "@/lib/db/queries";

let projectId: string;

function context() {
  return { params: Promise.resolve({ id: projectId }) };
}

beforeEach(() => {
  state.db = createDatabase(":memory:");
  const project = createProject(state.db, {
    name: "Shareable app",
    prompt: "A shareable app",
    archetype: "top-nav-cards",
  });
  projectId = project.id;
});

function request(path: string, method = "POST"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("POST /api/projects/:id/share", () => {
  it("creates a public URL and returns the same link on repeated shares", async () => {
    const first = await POST(request(`/api/projects/${projectId}/share`), context());
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.slug).toBeTruthy();
    expect(body.url).toBe(`http://localhost/p/${body.slug}`);

    expect(getProjectByShareSlug(state.db!, body.slug)?.id).toBe(projectId);
    expect(getProject(state.db!, projectId)!.shareSlug).toBe(body.slug);

    const second = await POST(request(`/api/projects/${projectId}/share`), context());
    expect((await second.json()).slug).toBe(body.slug);
  });

  it("404s for an unknown project", async () => {
    const response = await POST(
      request("/api/projects/missing/share"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/projects/:id/share", () => {
  it("revokes the link so it no longer resolves", async () => {
    const created = await POST(
      request(`/api/projects/${projectId}/share`),
      context(),
    );
    const { slug } = await created.json();

    const revoked = await DELETE(
      request(`/api/projects/${projectId}/share`, "DELETE"),
      context(),
    );
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ revoked: true });

    expect(getProjectByShareSlug(state.db!, slug)).toBeUndefined();
    expect(getProject(state.db!, projectId)!.shareSlug).toBeNull();
  });
});
