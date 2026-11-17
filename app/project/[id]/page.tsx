import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/db/client";
import { getEntryPage, getProject, listPages } from "@/lib/db/queries";
import { EditorShell } from "@/components/editor-shell";
import { toPageDTO, toProjectDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDatabase();
  const project = getProject(db, id);
  if (!project) notFound();

  const pages = listPages(db, id);
  if (pages.length === 0) notFound();
  const entry = getEntryPage(db, id) ?? pages[0];

  return (
    <EditorShell
      project={toProjectDTO(project)}
      pages={pages.map(toPageDTO)}
      initialPageId={entry.id}
    />
  );
}
