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

import { POST } from "@/app/api/generations/route";
import { createDatabase } from "@/lib/db/client";
import { createGeneration, listProposals } from "@/lib/db/queries";
import { generatePageText } from "@/lib/llm/generate";
import { parseSseEvents } from "@/lib/sse";

const generate = vi.mocked(generatePageText);

const HEADERS = {
  "content-type": "application/json",
  "x-llm-api-key": "sk-test-key",
  "x-llm-provider": "openai",
  "x-llm-model": "gpt-4o",
};

function request(
  body: unknown,
  headers: Record<string, string> = HEADERS,
): Request {
  return new Request("http://localhost/api/generations", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function validHtml(label: string): string {
  return `<!DOCTYPE html><html><head><title>${label}</title></head><body><h1>${label}</h1><a href="page://settings">Settings</a></body></html>`;
}

type Event = {
  type: string;
  generationId?: string;
  variantIndex?: number;
  archetype?: string;
  proposalId?: string;
  html?: string;
  error?: string;
};

async function run(body: unknown, headers = HEADERS) {
  const response = await POST(request(body, headers));
  const text = await response.text();
  return {
    response,
    text,
    events: parseSseEvents(text) as Event[],
  };
}

beforeEach(() => {
  state.db = createDatabase(":memory:");
  generate.mockReset();
});

describe("POST /api/generations", () => {
  it("streams five variant events and persists five proposals", async () => {
    let counter = 0;
    generate.mockImplementation(async () => {
      counter += 1;
      return validHtml(`variant-${counter}`);
    });

    const { response, events } = await run({ prompt: "A booking app" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const generation = events.find((event) => event.type === "generation");
    expect(generation?.generationId).toBeTruthy();

    const variants = events.filter((event) => event.type === "variant");
    expect(variants).toHaveLength(5);
    expect(new Set(variants.map((event) => event.archetype)).size).toBe(5);
    expect(
      variants.map((event) => event.variantIndex).sort((a, b) => a! - b!),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(variants.every((event) => event.proposalId && event.html)).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });

    const proposals = listProposals(state.db!, generation!.generationId!);
    expect(proposals).toHaveLength(5);
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it("isolates a failed variant without blocking the others", async () => {
    generate.mockImplementation(async ({ prompt }) => {
      if (prompt.includes("Dashboard grid")) {
        throw new Error("socket hang up");
      }
      return validHtml("ok");
    });

    const { events } = await run({ prompt: "An inventory app" });

    const failures = events.filter((event) => event.type === "variant_error");
    expect(failures).toHaveLength(1);
    expect(failures[0].archetype).toBe("dashboard-grid");
    expect(failures[0].error).toMatch(/Settings/);

    const variants = events.filter((event) => event.type === "variant");
    expect(variants).toHaveLength(4);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("auto-retries once when a variant returns invalid HTML", async () => {
    const attempts = new Map<string, number>();
    generate.mockImplementation(async ({ prompt }) => {
      if (!prompt.includes("Wizard / stepper")) return validHtml("ok");
      const count = (attempts.get("wizard") ?? 0) + 1;
      attempts.set("wizard", count);
      return count === 1 ? "I cannot do that." : validHtml("wizard-fixed");
    });

    const { events } = await run({ prompt: "A travel planner" });

    const wizardCalls = generate.mock.calls.filter(([input]) =>
      input.prompt.includes("Wizard / stepper"),
    );
    expect(wizardCalls).toHaveLength(2);
    expect(wizardCalls[1][0].prompt).toMatch(/failed validation/i);

    const wizard = events.find(
      (event) => event.type === "variant" && event.archetype === "wizard-stepper",
    );
    expect(wizard).toBeTruthy();
    expect(events.some((event) => event.type === "variant_error")).toBe(false);
  });

  it("reports invalid output after the retry is exhausted", async () => {
    generate.mockImplementation(async ({ prompt }) => {
      if (prompt.includes("Master-detail")) return "still not html";
      return validHtml("ok");
    });

    const { events } = await run({ prompt: "A CRM" });
    const failure = events.find(
      (event) => event.type === "variant_error" && event.archetype === "master-detail",
    );
    expect(failure?.error).toMatch(/did not return valid HTML/i);
  });

  it("rejects LLM-backed requests without a key before any call", async () => {
    const { response, events, text } = await run(
      { prompt: "A booking app" },
      { "content-type": "application/json" },
    );
    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
    expect(JSON.parse(text)).toMatchObject({ code: "missing_key" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("regenerates a single variant for per-card retry", async () => {
    const db = state.db!;
    const generation = createGeneration(db, "A recipe app");
    generate.mockResolvedValue(validHtml("retried"));

    const { events } = await run({
      generationId: generation.id,
      variantIndex: 3,
    });

    expect(events[0]).toMatchObject({
      type: "generation",
      generationId: generation.id,
    });
    expect(events[1]).toMatchObject({
      type: "variant",
      variantIndex: 3,
      archetype: "dashboard-grid",
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(listProposals(db, generation.id)).toHaveLength(1);
  });

  it("requires a prompt for a fresh generation", async () => {
    const { response } = await run({ prompt: "   " });
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
