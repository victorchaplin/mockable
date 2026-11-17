import { randomUUID } from "node:crypto";
import { and, asc, eq, desc } from "drizzle-orm";
import type { Db } from "./client";
import { canonicalPageName, titleFromPageName } from "../page-name";
import {
  generations,
  pages,
  projects,
  proposals,
  type GenerationRow,
  type PageRow,
  type ProjectRow,
  type ProposalRow,
} from "./schema";

export function nowIso(): string {
  return new Date().toISOString();
}

export { canonicalPageName, titleFromPageName };

/** Derive a human project name from the prompt (first line, trimmed). */
export function deriveProjectName(prompt: string): string {
  const firstLine = prompt.trim().split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  if (!cleaned) return "Untitled mock";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}

export class DuplicatePageNameError extends Error {
  constructor(name: string) {
    super(`A page named "${name}" already exists in this project.`);
    this.name = "DuplicatePageNameError";
  }
}

export const MAX_PAGE_NAME_LENGTH = 60;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error && /UNIQUE constraint failed/i.test(error.message)
  );
}

/* ------------------------------------------------------------------ */
/* Generations + proposals                                             */
/* ------------------------------------------------------------------ */

export function createGeneration(db: Db, prompt: string): GenerationRow {
  const row: GenerationRow = {
    id: randomUUID(),
    prompt,
    createdAt: nowIso(),
  };
  db.insert(generations).values(row).run();
  return row;
}

export function getGeneration(db: Db, id: string): GenerationRow | undefined {
  return db.select().from(generations).where(eq(generations.id, id)).get();
}

export function createProposal(
  db: Db,
  input: {
    generationId: string;
    variantIndex: number;
    archetype: string;
    html: string;
  },
): ProposalRow {
  const row: ProposalRow = {
    id: randomUUID(),
    generationId: input.generationId,
    variantIndex: input.variantIndex,
    archetype: input.archetype,
    html: input.html,
    createdAt: nowIso(),
    pickedAt: null,
  };
  db.insert(proposals).values(row).run();
  return row;
}

export function getProposal(
  db: Db,
  id: string,
): { proposal: ProposalRow; generation: GenerationRow } | undefined {
  const row = db
    .select({ proposal: proposals, generation: generations })
    .from(proposals)
    .innerJoin(generations, eq(proposals.generationId, generations.id))
    .where(eq(proposals.id, id))
    .get();
  return row;
}

export function listProposals(db: Db, generationId: string): ProposalRow[] {
  return db
    .select()
    .from(proposals)
    .where(eq(proposals.generationId, generationId))
    .orderBy(asc(proposals.variantIndex))
    .all();
}

export function markProposalPicked(db: Db, id: string): void {
  db.update(proposals)
    .set({ pickedAt: nowIso() })
    .where(eq(proposals.id, id))
    .run();
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function createProject(
  db: Db,
  input: { name: string; prompt: string; archetype: string },
): ProjectRow {
  const timestamp = nowIso();
  const row: ProjectRow = {
    id: randomUUID(),
    name: input.name,
    prompt: input.prompt,
    archetype: input.archetype,
    shareSlug: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.insert(projects).values(row).run();
  return row;
}

export function getProject(db: Db, id: string): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export type ProjectSummary = ProjectRow & { pageCount: number };

export function listProjects(db: Db): ProjectSummary[] {
  const rows = db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .all();
  const counts = db
    .select({ projectId: pages.projectId, pageId: pages.id })
    .from(pages)
    .all();
  const countByProject = new Map<string, number>();
  for (const { projectId } of counts) {
    countByProject.set(projectId, (countByProject.get(projectId) ?? 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    pageCount: countByProject.get(row.id) ?? 0,
  }));
}

export function renameProject(db: Db, id: string, name: string): void {
  db.update(projects)
    .set({ name: name.trim() || "Untitled mock", updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function touchProject(db: Db, id: string): void {
  db.update(projects).set({ updatedAt: nowIso() }).where(eq(projects.id, id)).run();
}

export function deleteProject(db: Db, id: string): void {
  // Pages cascade via the foreign key; the share slug disappears with the row,
  // so any previously shared URL stops resolving.
  db.delete(projects).where(eq(projects.id, id)).run();
}

export function setShareSlug(db: Db, id: string, slug: string): void {
  db.update(projects)
    .set({ shareSlug: slug, updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function clearShareSlug(db: Db, id: string): void {
  db.update(projects)
    .set({ shareSlug: null, updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function getProjectByShareSlug(
  db: Db,
  slug: string,
): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.shareSlug, slug)).get();
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function createPage(
  db: Db,
  input: {
    projectId: string;
    name: string;
    title: string;
    html: string;
    isEntry?: boolean;
  },
): PageRow {
  const name = canonicalPageName(input.name);
  const existing = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, input.projectId))
    .all();
  if (existing.some((page) => page.name === name)) {
    throw new DuplicatePageNameError(name);
  }

  const timestamp = nowIso();
  const position =
    existing.reduce((max, page) => Math.max(max, page.position), -1) + 1;
  const row: PageRow = {
    id: randomUUID(),
    projectId: input.projectId,
    name,
    title: input.title,
    isEntry: input.isEntry ?? existing.length === 0,
    html: input.html,
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    db.insert(pages).values(row).run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicatePageNameError(name);
    throw error;
  }
  touchProject(db, input.projectId);
  return row;
}

export function listPages(db: Db, projectId: string): PageRow[] {
  return db
    .select()
    .from(pages)
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.position), asc(pages.createdAt))
    .all();
}

export function getPage(
  db: Db,
  projectId: string,
  pageId: string,
): PageRow | undefined {
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .get();
}

export function getEntryPage(db: Db, projectId: string): PageRow | undefined {
  return listPages(db, projectId).find((page) => page.isEntry);
}

export function findPageByName(
  db: Db,
  projectId: string,
  name: string,
): PageRow | undefined {
  const canonical = canonicalPageName(name);
  return listPages(db, projectId).find((page) => page.name === canonical);
}

export function updatePage(
  db: Db,
  projectId: string,
  pageId: string,
  input: { html?: string; title?: string; name?: string },
): PageRow {
  const current = getPage(db, projectId, pageId);
  if (!current) throw new Error("Page not found");

  const next = {
    html: input.html ?? current.html,
    title: input.title?.trim() || current.title,
    name: input.name === undefined ? current.name : canonicalPageName(input.name),
    updatedAt: nowIso(),
  };

  if (next.name !== current.name) {
    const clash = findPageByName(db, projectId, next.name);
    if (clash && clash.id !== pageId) throw new DuplicatePageNameError(next.name);
  }

  try {
    db.update(pages)
      .set(next)
      .where(eq(pages.id, pageId))
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicatePageNameError(next.name);
    throw error;
  }
  touchProject(db, projectId);
  return { ...current, ...next };
}

export function deletePage(
  db: Db,
  projectId: string,
  pageId: string,
): void {
  db.delete(pages).where(eq(pages.id, pageId)).run();
  touchProject(db, projectId);
}

/** Create a project plus its entry page from a picked proposal (transactional). */
export function createProjectFromProposal(
  db: Db,
  input: { proposalId: string; name?: string },
): { project: ProjectRow; page: PageRow } {
  const found = getProposal(db, input.proposalId);
  if (!found) throw new Error("Proposal not found");

  const { proposal, generation } = found;
  const projectName = input.name?.trim() || deriveProjectName(generation.prompt);

  return db.transaction((tx) => {
    const project = createProject(tx as Db, {
      name: projectName,
      prompt: generation.prompt,
      archetype: proposal.archetype,
    });
    const page = createPage(tx as Db, {
      projectId: project.id,
      name: "home",
      title: project.name,
      html: proposal.html,
      isEntry: true,
    });
    markProposalPicked(tx as Db, proposal.id);
    return { project, page };
  });
}
