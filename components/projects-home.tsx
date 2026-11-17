"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type ProjectSummaryDTO = {
  id: string;
  name: string;
  archetype: string;
  shareSlug: string | null;
  pageCount: number;
  updatedAt: string;
};

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function ProjectsHome({
  projects: initialProjects,
}: {
  projects: ProjectSummaryDTO[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  function startRename(project: ProjectSummaryDTO) {
    setRenamingId(project.id);
    setRenameValue(project.name);
    setDeletingId(null);
    setError(null);
  }

  async function saveRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renamingId || !renameValue.trim() || busyId) return;
    const id = renamingId;
    const name = renameValue.trim();
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Rename failed.");
      setProjects((current) =>
        current.map((project) =>
          project.id === id ? { ...project, name } : project,
        ),
      );
      setRenamingId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rename failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setProjects((current) => current.filter((project) => project.id !== id));
      setDeletingId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New mock
        </Link>
        <Link
          href="/settings"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Settings
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {error}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">No mock projects yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Start from a prompt and compare five layout proposals.
          </p>
          <Link href="/new" className="mt-4 inline-block font-medium underline">
            Create your first mock
          </Link>
        </div>
      ) : (
        <ul aria-label="Projects" className="flex flex-col gap-3">
          {projects.map((project) => (
            <li
              key={project.id}
              data-testid={`project-${project.id}`}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              {renamingId === project.id ? (
                <form onSubmit={saveRename} className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`rename-${project.id}`} className="sr-only">
                    Project name
                  </label>
                  <input
                    id={`rename-${project.id}`}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    autoFocus
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={busyId === project.id || !renameValue.trim()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/project/${project.id}`}
                      className="text-base font-semibold hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {project.archetype} · {project.pageCount}{" "}
                      {project.pageCount === 1 ? "page" : "pages"} · updated{" "}
                      {formatUpdated(project.updatedAt)}
                    </p>
                  </div>

                  {project.shareSlug ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Shared
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => startRename(project)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingId(project.id);
                      setRenamingId(null);
                      setError(null);
                    }}
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deletingId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete project"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Delete this project?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This permanently removes the project and its pages, and revokes
              its share link if it has one.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deletingId)}
                disabled={busyId === deletingId}
                className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {busyId === deletingId ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
