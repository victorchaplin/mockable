// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import {
  ProjectsHome,
  type ProjectSummaryDTO,
} from "@/components/projects-home";

const PROJECTS: ProjectSummaryDTO[] = [
  {
    id: "p1",
    name: "Booking app",
    archetype: "sidebar-shell",
    shareSlug: "abc123",
    pageCount: 2,
    updatedAt: "2026-11-16T10:30:00.000Z",
  },
  {
    id: "p2",
    name: "Recipe box",
    archetype: "top-nav-cards",
    shareSlug: null,
    pageCount: 1,
    updatedAt: "2026-11-15T08:00:00.000Z",
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("ProjectsHome", () => {
  it("lists projects with updated time, shared badge, and navigation", () => {
    render(<ProjectsHome projects={PROJECTS} />);

    expect(screen.getByRole("link", { name: "Booking app" })).toHaveAttribute(
      "href",
      "/project/p1",
    );
    expect(screen.getByRole("link", { name: "Recipe box" })).toHaveAttribute(
      "href",
      "/project/p2",
    );
    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(screen.getAllByText(/updated 2026-11-1/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "New mock" })).toHaveAttribute(
      "href",
      "/new",
    );
  });

  it("shows an empty state with a way to start", () => {
    render(<ProjectsHome projects={[]} />);
    expect(screen.getByText("No mock projects yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first mock" }),
    ).toHaveAttribute("href", "/new");
  });

  it("renames a project inline and refreshes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ project: { id: "p1", name: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsHome projects={PROJECTS} />);
    const user = userEvent.setup();
    const row = screen.getByTestId("project-p1");

    await user.click(within(row).getByRole("button", { name: "Rename" }));
    const input = within(row).getByLabelText("Project name");
    await user.clear(input);
    await user.type(input, "Renamed");
    await user.click(within(row).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Renamed" })).toBeInTheDocument(),
    );
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/projects/p1");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      name: "Renamed",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("requires confirmation before deleting and removes the project", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ deleted: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsHome projects={PROJECTS} />);
    const user = userEvent.setup();
    const row = screen.getByTestId("project-p1");

    await user.click(within(row).getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm delete project" });
    expect(dialog).toHaveTextContent(/revokes its share link/i);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("project-p1")).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete project",
      }),
    );

    await waitFor(() => expect(screen.queryByTestId("project-p1")).toBeNull());
    expect(screen.getByTestId("project-p2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", {
      method: "DELETE",
    });
    expect(refresh).toHaveBeenCalled();
  });
});
