import { getDatabase } from "@/lib/db/client";
import { listProjects } from "@/lib/db/queries";
import { ProjectsHome } from "@/components/projects-home";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const db = getDatabase();
  const projects = listProjects(db).map((project) => ({
    id: project.id,
    name: project.name,
    archetype: project.archetype,
    shareSlug: project.shareSlug,
    pageCount: project.pageCount,
    updatedAt: project.updatedAt,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">mockable</h1>
        <p className="max-w-2xl text-slate-600">
          Turn a prompt into five layout-divergent mock proposals, refine the
          one you pick into a clickable multi-page prototype, and share it.
        </p>
      </div>
      <ProjectsHome projects={projects} />
    </main>
  );
}
