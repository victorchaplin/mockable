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

vi.mock("@/lib/llm/generate", () => ({
  generatePageText: vi.fn(),
}));

import { PATCH as patchPage } from "@/app/api/projects/[id]/pages/[pageId]/route";
import { POST as editPage } from "@/app/api/projects/[id]/pages/[pageId]/edit/route";
import { POST as addPage } from "@/app/api/projects/[id]/pages/route";
import { createDatabase } from "@/lib/db/client";
import {
  createPage,
  createProject,
  getPage,
  listPages,
} from "@/lib/db/queries";
import { generatePageText } from "@/lib/llm/generate";
import { parseSseEvents } from "@/lib/sse";
import type { EditorEvent } from "@/lib/types";

const generate = vi.mocked(generatePageText);

const HEADERS = {
  "content-type": "application/json",
  "x-llm-api-key": "sk-test-key",
  "x-llm-provider": "openai",
  "x-llm-model": "gpt-4o",
};

const HOME_HTML =
  '<!DOCTYPE html><html><body><h1>Home</h1><a href="page://settings">Settings</a></body></html>';

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function patchRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function runEdit(
  projectId: string,
  pageId: string,
  message: string,
): Promise<EditorEvent[]> {
  const response = await editPage(
    jsonRequest(`http://localhost/api/projects/${projectId}/pages/${pageId}/edit`, {
      message,
    }),
    { params: Promise.resolve({ id: projectId, pageId }) },
  );
  const text = await response.text();
  return parseSseEvents(text) as EditorEvent[];
}

let projectId: string;
let pageId: string;

beforeEach(() => {
  state.db = createDatabase(":memory:");
  generate.mockReset();

  const db = state.db;
  const project = createProject(db, {
    name: "Booking app",
    prompt: "A booking app",
    archetype: "sidebar-shell",
  });
  const page = createPage(db, {
    projectId: project.id,
    name: "home",
    title: "Home",
    html: HOME_HTML,
    isEntry: true,
  });
  projectId = project.id;
  pageId = page.id;
});

describe("PATCH /api/projects/:id/pages/:pageId", () => {
  it("persists a manual HTML edit and returns the updated page", async () => {
    const nextHtml =
      '<!DOCTYPE html><html><body><h1>Manual edit</h1><a href="page://settings">S</a></body></html>';
    const response = await patchPage(
      patchRequest(
        `http://localhost/api/projects/${projectId}/pages/${pageId}`,
        { html: nextHtml },
      ),
      { params: Promise.resolve({ id: projectId, pageId }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.page.html).toContain("Manual edit");
    expect(getPage(state.db!, projectId, pageId)!.html).toContain("Manual edit");
  });

  it("rejects invalid HTML with a clear error", async () => {
    const response = await patchPage(
      patchRequest(
        `http://localhost/api/projects/${projectId}/pages/${pageId}`,
        { html: "<div>fragment</div>" },
      ),
      { params: Promise.resolve({ id: projectId, pageId }) },
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("invalid_html");
    expect(getPage(state.db!, projectId, pageId)!.html).toBe(HOME_HTML);
  });
});

describe("POST /api/projects/:id/pages/:pageId/edit", () => {
  it("rewrites the whole page and persists it", async () => {
    generate.mockResolvedValue(
      '<!DOCTYPE html><html><body><h1>Refined home</h1><a href="page://settings">S</a></body></html>',
    );

    const events = await runEdit(projectId, pageId, "Add a search bar to the header");

    expect(events[0]).toMatchObject({ type: "status" });
    const pageEvent = events.find((event) => event.type === "page");
    expect(pageEvent).toMatchObject({ type: "page" });
    if (pageEvent?.type === "page") {
      expect(pageEvent.page.html).toContain("Refined home");
    }
    expect(events.at(-1)).toEqual({ type: "done" });

    expect(getPage(state.db!, projectId, pageId)!.html).toContain("Refined home");

    const prompt = generate.mock.calls[0][0].prompt;
    expect(prompt).toContain("sidebar-shell");
    expect(prompt).toContain("page://settings");
    expect(prompt).toContain("Home");
    expect(prompt).toContain("Add a search bar to the header");
    expect(prompt).toContain("<h1>Home</h1>"); // the saved page is the baseline
  });

  it("creates a page when the chat asks for one", async () => {
    generate.mockResolvedValue(
      '<!DOCTYPE html><html><body><h1>Settings</h1><a href="page://home">Home</a></body></html>',
    );

    const events = await runEdit(projectId, pageId, "add a settings page");

    const created = events.find((event) => event.type === "page_created");
    expect(created).toMatchObject({ type: "page_created" });
    if (created?.type === "page_created") {
      expect(created.page.name).toBe("settings");
    }
    expect(listPages(state.db!, projectId).map((page) => page.name)).toEqual([
      "home",
      "settings",
    ]);
  });

  it("surfaces safe LLM errors as an error event", async () => {
    generate.mockRejectedValue(
      Object.assign(new Error("Unauthorized sk-secret"), { statusCode: 401 }),
    );

    const events = await runEdit(projectId, pageId, "Make it blue");
    const failure = events.find((event) => event.type === "error");
    expect(failure).toMatchObject({ type: "error" });
    if (failure?.type === "error") {
      expect(failure.error).toMatch(/Settings/);
      expect(failure.error).not.toContain("sk-secret");
    }
    expect(getPage(state.db!, projectId, pageId)!.html).toBe(HOME_HTML);
  });
});

describe("POST /api/projects/:id/pages", () => {
  it("adds a consistent new page and returns it", async () => {
    generate.mockResolvedValue(
      '<!DOCTYPE html><html><body><h1>Checkout</h1><a href="page://home">Home</a></body></html>',
    );

    const response = await addPage(
      jsonRequest(`http://localhost/api/projects/${projectId}/pages`, {
        name: "Checkout",
        description: "Payment and order review",
      }),
      { params: Promise.resolve({ id: projectId }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.page).toMatchObject({
      name: "checkout",
      title: "Checkout",
      isEntry: false,
    });

    const prompt = generate.mock.calls[0][0].prompt;
    expect(prompt).toContain("page://home");
    expect(prompt).toContain("Payment and order review");
    expect(prompt).toContain("NEW PAGE NAME: Checkout");
    expect(listPages(state.db!, projectId)).toHaveLength(2);
  });

  it("rejects duplicate names", async () => {
    const response = await addPage(
      jsonRequest(`http://localhost/api/projects/${projectId}/pages`, {
        name: "home",
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(response.status).toBe(409);
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns a safe error when the LLM fails", async () => {
    generate.mockRejectedValue(new Error("quota exceeded"));
    const response = await addPage(
      jsonRequest(`http://localhost/api/projects/${projectId}/pages`, {
        name: "billing",
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/quota/i);
    expect(body.error).toMatch(/Settings/);
  });
});
