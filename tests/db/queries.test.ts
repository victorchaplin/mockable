import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/lib/db/client";
import {
  DuplicatePageNameError,
  canonicalPageName,
  clearShareSlug,
  createGeneration,
  createPage,
  createProject,
  createProjectFromProposal,
  createProposal,
  deletePage,
  deleteProject,
  deriveProjectName,
  findPageByName,
  getPage,
  getProject,
  getProjectByShareSlug,
  listPages,
  listProjects,
  listProposals,
  markProposalPicked,
  renameProject,
  setShareSlug,
  updatePage,
} from "@/lib/db/queries";

const HTML = "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>";

let db: Db;

beforeEach(() => {
  db = createDatabase(":memory:");
});

describe("name helpers", () => {
  it("canonicalizes page names into link-safe slugs", () => {
    expect(canonicalPageName(" Settings Page ")).toBe("settings-page");
    expect(canonicalPageName("page://Checkout")).toBe("checkout");
    expect(canonicalPageName("a/b?c")).toBe("a-b-c");
    expect(canonicalPageName("???")).toBe("page");
  });

  it("derives a readable project name from the prompt", () => {
    expect(deriveProjectName("A coffee shop ordering app")).toBe(
      "A coffee shop ordering app",
    );
    expect(deriveProjectName("")).toBe("Untitled mock");
  });
});

describe("projects", () => {
  it("creates, lists, reads, and renames projects", () => {
    const project = createProject(db, {
      name: "Coffee app",
      prompt: "A coffee shop app",
      archetype: "sidebar-shell",
    });
    expect(getProject(db, project.id)?.name).toBe("Coffee app");
    expect(listProjects(db)[0]).toMatchObject({
      id: project.id,
      pageCount: 0,
      shareSlug: null,
    });

    renameProject(db, project.id, "Coffee ordering");
    expect(getProject(db, project.id)?.name).toBe("Coffee ordering");
  });

  it("sets, resolves, and clears share slugs", () => {
    const project = createProject(db, {
      name: "Shareable",
      prompt: "p",
      archetype: "dashboard-grid",
    });
    setShareSlug(db, project.id, "abc123");
    expect(getProjectByShareSlug(db, "abc123")?.id).toBe(project.id);

    clearShareSlug(db, project.id);
    expect(getProjectByShareSlug(db, "abc123")).toBeUndefined();
  });

  it("deletes pages with the project and revokes the shared link", () => {
    const project = createProject(db, {
      name: "Delete me",
      prompt: "p",
      archetype: "top-nav-cards",
    });
    createPage(db, {
      projectId: project.id,
      name: "home",
      title: "Home",
      html: HTML,
    });
    setShareSlug(db, project.id, "gone-soon");

    deleteProject(db, project.id);

    expect(getProject(db, project.id)).toBeUndefined();
    expect(listPages(db, project.id)).toHaveLength(0);
    expect(getProjectByShareSlug(db, "gone-soon")).toBeUndefined();
  });
});

describe("pages", () => {
  it("enforces unique page names per project, not globally", () => {
    const a = createProject(db, { name: "A", prompt: "a", archetype: "x" });
    const b = createProject(db, { name: "B", prompt: "b", archetype: "x" });

    createPage(db, {
      projectId: a.id,
      name: "Home",
      title: "Home",
      html: HTML,
      isEntry: true,
    });
    expect(() =>
      createPage(db, {
        projectId: a.id,
        name: "home",
        title: "Dup",
        html: HTML,
      }),
    ).toThrow(DuplicatePageNameError);

    const other = createPage(db, {
      projectId: b.id,
      name: "home",
      title: "Home B",
      html: HTML,
    });
    expect(other.name).toBe("home");
  });

  it("marks the first page as the entry page", () => {
    const project = createProject(db, { name: "P", prompt: "p", archetype: "x" });
    const first = createPage(db, {
      projectId: project.id,
      name: "home",
      title: "Home",
      html: HTML,
    });
    const second = createPage(db, {
      projectId: project.id,
      name: "settings",
      title: "Settings",
      html: HTML,
    });

    expect(first.isEntry).toBe(true);
    expect(second.isEntry).toBe(false);
    expect(second.position).toBeGreaterThan(first.position);
  });

  it("updates html and title, and keeps the project timestamp fresh", async () => {
    const project = createProject(db, { name: "P", prompt: "p", archetype: "x" });
    const page = createPage(db, {
      projectId: project.id,
      name: "home",
      title: "Home",
      html: HTML,
    });
    const before = getProject(db, project.id)!.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = updatePage(db, project.id, page.id, {
      html: "<html><body>new</body></html>",
      title: "New home",
    });

    expect(updated.html).toContain("new");
    expect(getPage(db, project.id, page.id)?.title).toBe("New home");
    expect(getProject(db, project.id)!.updatedAt).not.toBe(before);
  });

  it("renames pages and rejects name clashes", () => {
    const project = createProject(db, { name: "P", prompt: "p", archetype: "x" });
    const home = createPage(db, {
      projectId: project.id,
      name: "home",
      title: "Home",
      html: HTML,
    });
    createPage(db, {
      projectId: project.id,
      name: "settings",
      title: "Settings",
      html: HTML,
    });

    updatePage(db, project.id, home.id, { name: "Dashboard" });
    expect(findPageByName(db, project.id, "dashboard")?.id).toBe(home.id);
    expect(() =>
      updatePage(db, project.id, home.id, { name: "settings" }),
    ).toThrow(DuplicatePageNameError);
  });

  it("deletes a single page", () => {
    const project = createProject(db, { name: "P", prompt: "p", archetype: "x" });
    const page = createPage(db, {
      projectId: project.id,
      name: "temp",
      title: "Temp",
      html: HTML,
    });
    deletePage(db, project.id, page.id);
    expect(getPage(db, project.id, page.id)).toBeUndefined();
  });
});

describe("generations and proposals", () => {
  it("persists proposals and creates a project + entry page from the pick", () => {
    const generation = createGeneration(db, "A recipe sharing app");
    const proposal = createProposal(db, {
      generationId: generation.id,
      variantIndex: 3,
      archetype: "wizard-stepper",
      html: HTML,
    });

    expect(listProposals(db, generation.id)).toHaveLength(1);

    const { project, page } = createProjectFromProposal(db, {
      proposalId: proposal.id,
    });

    expect(project).toMatchObject({
      name: "A recipe sharing app",
      prompt: "A recipe sharing app",
      archetype: "wizard-stepper",
    });
    expect(page).toMatchObject({
      name: "home",
      isEntry: true,
      html: HTML,
    });
    expect(listProposals(db, generation.id)[0].pickedAt).not.toBeNull();
    expect(listProjects(db)).toHaveLength(1);
  });

  it("allows marking a proposal picked independently", () => {
    const generation = createGeneration(db, "p");
    const proposal = createProposal(db, {
      generationId: generation.id,
      variantIndex: 1,
      archetype: "sidebar-shell",
      html: HTML,
    });
    markProposalPicked(db, proposal.id);
    expect(listProposals(db, generation.id)[0].pickedAt).not.toBeNull();
  });
});
