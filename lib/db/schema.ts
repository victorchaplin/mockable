import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema (design D2). All ids are text UUIDs; timestamps are ISO text.
 * Queries stay boring SQL so the Turso/Postgres swaps remain cheap.
 */

export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  createdAt: text("created_at").notNull(),
});

export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  generationId: text("generation_id")
    .notNull()
    .references(() => generations.id, { onDelete: "cascade" }),
  variantIndex: integer("variant_index").notNull(),
  archetype: text("archetype").notNull(),
  html: text("html").notNull(),
  createdAt: text("created_at").notNull(),
  pickedAt: text("picked_at"),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    archetype: text("archetype").notNull(),
    shareSlug: text("share_slug"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("projects_share_slug_unique").on(table.shareSlug)],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    isEntry: integer("is_entry", { mode: "boolean" }).notNull().default(false),
    html: text("html").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("pages_project_name_unique").on(table.projectId, table.name),
  ],
);

export type GenerationRow = typeof generations.$inferSelect;
export type ProposalRow = typeof proposals.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
