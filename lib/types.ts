import type { PageRow, ProjectRow } from "./db/schema";

/** Wire shapes shared by server routes and client components. */

export type PageDTO = Pick<
  PageRow,
  "id" | "name" | "title" | "isEntry" | "html"
>;

export type ProjectDTO = Pick<
  ProjectRow,
  "id" | "name" | "shareSlug" | "archetype"
>;

export type EditorEvent =
  | { type: "status"; message: string }
  | { type: "page"; page: PageDTO }
  | { type: "page_created"; page: PageDTO }
  | { type: "error"; error: string }
  | { type: "done" };

export function toPageDTO(page: PageRow): PageDTO {
  return {
    id: page.id,
    name: page.name,
    title: page.title,
    isEntry: page.isEntry,
    html: page.html,
  };
}

export function toProjectDTO(project: ProjectRow): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    shareSlug: project.shareSlug,
    archetype: project.archetype,
  };
}
