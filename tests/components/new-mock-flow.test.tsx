// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/llm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm-client")>();
  return { ...actual, llmFetch: vi.fn() };
});

import { NewMockFlow } from "@/components/new-mock-flow";
import { llmFetch, MissingLlmSettingsError } from "@/lib/llm-client";

const mockedFetch = vi.mocked(llmFetch);

function html(label: string): string {
  return `<!DOCTYPE html><html><body><h1>${label}</h1><a href="page://settings">Settings</a></body></html>`;
}

function sseResponse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function fullGeneration(): Response {
  return sseResponse([
    { type: "generation", generationId: "gen-1" },
    { type: "variant", variantIndex: 1, archetype: "sidebar-shell", proposalId: "p1", html: html("One") },
    { type: "variant", variantIndex: 2, archetype: "top-nav-cards", proposalId: "p2", html: html("Two") },
    { type: "variant", variantIndex: 3, archetype: "dashboard-grid", proposalId: "p3", html: html("Three") },
    { type: "variant", variantIndex: 4, archetype: "wizard-stepper", proposalId: "p4", html: html("Four") },
    { type: "variant", variantIndex: 5, archetype: "master-detail", proposalId: "p5", html: html("Five") },
    { type: "done" },
  ]);
}

beforeEach(() => {
  mockedFetch.mockReset();
  push.mockReset();
});

async function startGeneration(): Promise<void> {
  const user = userEvent.setup();
  render(<NewMockFlow />);
  await user.type(
    screen.getByLabelText("Describe the app you want to mock"),
    "A booking app for boutique hotels",
  );
  await user.click(screen.getByRole("button", { name: "Generate 5 proposals" }));
}

describe("NewMockFlow", () => {
  it("renders five interactive live previews before picking", async () => {
    mockedFetch.mockResolvedValue(fullGeneration());
    await startGeneration();

    const pickButtons = await screen.findAllByRole("button", {
      name: "Use this layout",
    });
    expect(pickButtons).toHaveLength(5);
    expect(screen.getByText("5 of 5 ready")).toBeInTheDocument();

    const frames = screen.getAllByTestId("preview-frame");
    expect(frames).toHaveLength(5);
    for (const frame of frames) {
      expect(frame).toHaveAttribute("sandbox", "allow-scripts");
      expect(frame.getAttribute("srcdoc")).toContain("page://settings");
    }

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("/api/generations");
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "A booking app for boutique hotels",
    });
  });

  it("picks a proposal and redirects into the editor", async () => {
    mockedFetch.mockResolvedValue(fullGeneration());
    await startGeneration();
    const user = userEvent.setup();

    const pickButtons = await screen.findAllByRole("button", {
      name: "Use this layout",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ projectId: "proj-1" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await user.click(pickButtons[0]);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/project/proj-1"));
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/projects/from-proposal");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      proposalId: "p1",
    });
    vi.unstubAllGlobals();
  });

  it("shows a settings prompt when no key is saved", async () => {
    mockedFetch.mockRejectedValue(new MissingLlmSettingsError());
    await startGeneration();

    expect(await screen.findByTestId("llm-settings-notice")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Settings" }),
    ).toHaveAttribute("href", "/settings");
  });

  it("shows a failed variant and retries just that card", async () => {
    mockedFetch.mockResolvedValueOnce(
      sseResponse([
        { type: "generation", generationId: "gen-1" },
        { type: "variant", variantIndex: 1, archetype: "sidebar-shell", proposalId: "p1", html: html("One") },
        { type: "variant_error", variantIndex: 2, archetype: "top-nav-cards", error: "The provider timed out." },
        { type: "variant", variantIndex: 3, archetype: "dashboard-grid", proposalId: "p3", html: html("Three") },
        { type: "done" },
      ]),
    );
    mockedFetch.mockResolvedValueOnce(
      sseResponse([
        { type: "generation", generationId: "gen-1" },
        { type: "variant", variantIndex: 2, archetype: "top-nav-cards", proposalId: "p2", html: html("Two") },
        { type: "done" },
      ]),
    );

    await startGeneration();
    expect(await screen.findByText("The provider timed out.")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 ready")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Use this layout" })).toHaveLength(3),
    );
    const retryCall = mockedFetch.mock.calls[1];
    expect(JSON.parse(String(retryCall[1]?.body))).toEqual({
      generationId: "gen-1",
      variantIndex: 2,
    });
  });
});
