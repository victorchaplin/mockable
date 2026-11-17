// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/llm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm-client")>();
  return { ...actual, llmFetch: vi.fn() };
});

import { EditorShell } from "@/components/editor-shell";
import { llmFetch } from "@/lib/llm-client";
import type { PageDTO, ProjectDTO } from "@/lib/types";

const mockedLlmFetch = vi.mocked(llmFetch);

const PROJECT: ProjectDTO = {
  id: "proj-1",
  name: "Booking app",
  shareSlug: null,
  archetype: "sidebar-shell",
};

function html(marker: string): string {
  return `<!DOCTYPE html><html><body><h1>${marker}</h1><a href="page://settings">Settings</a></body></html>`;
}

const HOME: PageDTO = {
  id: "page-home",
  name: "home",
  title: "Home",
  isEntry: true,
  html: html("Home page marker"),
};

const SETTINGS: PageDTO = {
  id: "page-settings",
  name: "settings",
  title: "Settings",
  isEntry: false,
  html: html("Settings page marker"),
};

function sseResponse(events: unknown[]): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function frameContent(): string {
  return screen.getByTestId("preview-frame").getAttribute("srcdoc") ?? "";
}

beforeEach(() => {
  mockedLlmFetch.mockReset();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("EditorShell", () => {
  it("renders chat and live preview side by side with page tabs and an entry marker", async () => {
    render(
      <EditorShell
        project={PROJECT}
        pages={[HOME, SETTINGS]}
        initialPageId={HOME.id}
      />,
    );

    expect(screen.getByRole("region", { name: "Refinement chat" })).toBeInTheDocument();
    expect(screen.getByTestId("preview-frame")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
    expect(frameContent()).toContain("Home page marker");

    const nav = screen.getByRole("navigation", { name: "Pages" });
    const homeTab = within(nav).getByRole("button", { name: /Home/ });
    expect(homeTab).toHaveTextContent("(entry)");
    expect(homeTab).toHaveAttribute("aria-current", "page");

    const user = userEvent.setup();
    await user.click(within(nav).getByRole("button", { name: /Settings/ }));
    expect(frameContent()).toContain("Settings page marker");
  });

  it("saves a manual code edit, re-renders the preview, and shows it after reload", async () => {
    const edited = html("Edited by hand");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ page: { ...HOME, html: edited } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Code" }));
    const code = await screen.findByLabelText("Page HTML");
    expect(code).toHaveValue(HOME.html);

    fireEvent.change(code, { target: { value: edited } });
    await user.click(screen.getByRole("button", { name: "Save code" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/saved/i),
    );
    expect(frameContent()).toContain("Edited by hand");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("/api/projects/proj-1/pages/page-home");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      html: edited,
    });

    first.unmount();

    // Re-render from the persisted page, as a page reload would.
    render(
      <EditorShell
        project={PROJECT}
        pages={[{ ...HOME, html: edited }]}
        initialPageId={HOME.id}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Code" }));
    expect(await screen.findByLabelText("Page HTML")).toHaveValue(edited);
    expect(frameContent()).toContain("Edited by hand");
  });

  it("refines the current page through chat", async () => {
    const refined = html("Refined marker");
    mockedLlmFetch.mockResolvedValue(
      sseResponse([
        { type: "status", message: "Rewriting the page…" },
        { type: "page", page: { ...HOME, html: refined } },
        { type: "done" },
      ]),
    );

    render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("Refinement request"),
      "Make the headline larger",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(frameContent()).toContain("Refined marker"));
    expect(mockedLlmFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedLlmFetch.mock.calls[0];
    expect(url).toBe("/api/projects/proj-1/pages/page-home/edit");
    expect(JSON.parse(String(init?.body))).toEqual({
      message: "Make the headline larger",
    });
    expect(screen.getByRole("log")).toHaveTextContent(/Updated the page/i);
  });

  it("adds a page requested in chat and opens it", async () => {
    mockedLlmFetch.mockResolvedValue(
      sseResponse([
        { type: "status", message: 'Creating the "settings" page…' },
        { type: "page_created", page: SETTINGS },
        { type: "done" },
      ]),
    );

    render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Refinement request"),
      "add a settings page",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    const nav = screen.getByRole("navigation", { name: "Pages" });
    await waitFor(() =>
      expect(within(nav).getByRole("button", { name: /Settings/ })).toBeInTheDocument(),
    );
    expect(frameContent()).toContain("Settings page marker");
  });

  it("offers to create a page for an unresolved page:// link, then resolves it", async () => {
    mockedLlmFetch.mockResolvedValue(jsonResponse({ page: SETTINGS }, 201));

    render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "mockable:navigate", page: "settings" },
      }),
    );

    const createButton = await screen.findByRole("button", {
      name: /Create page .*settings/i,
    });
    const user = userEvent.setup();
    await user.click(createButton);

    await waitFor(() =>
      expect(frameContent()).toContain("Settings page marker"),
    );
    expect(mockedLlmFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/pages",
      expect.objectContaining({ method: "POST" }),
    );

    // The link now resolves: clicking it again navigates instead of offering creation.
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "mockable:navigate", page: "settings" },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Create page .*settings/i })).toBeNull(),
    );
    expect(frameContent()).toContain("Settings page marker");
  });

  it("adds a page through the Add page control", async () => {
    mockedLlmFetch.mockResolvedValue(jsonResponse({ page: SETTINGS }, 201));

    render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Add page" }));
    await user.type(screen.getByLabelText("New page name"), "settings");
    await user.type(
      screen.getByLabelText("New page description"),
      "Account and notification settings",
    );
    await user.click(screen.getByRole("button", { name: "Create page" }));

    const nav = screen.getByRole("navigation", { name: "Pages" });
    await waitFor(() =>
      expect(within(nav).getByRole("button", { name: /Settings/ })).toBeInTheDocument(),
    );
    const call = mockedLlmFetch.mock.calls[0];
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      name: "settings",
      description: "Account and notification settings",
    });
  });

  it("shares the flow, copies the link, and revokes it", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({
          slug: "abc123",
          url: "http://localhost:3000/p/abc123",
        });
      }
      return jsonResponse({ revoked: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EditorShell project={PROJECT} pages={[HOME]} initialPageId={HOME.id} />,
    );
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(screen.getByRole("button", { name: "Share" }));
    const link = await screen.findByLabelText("Share link");
    expect(link).toHaveValue("http://localhost:3000/p/abc123");

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/p/abc123");

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Share link")).toBeNull(),
    );
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });
});
