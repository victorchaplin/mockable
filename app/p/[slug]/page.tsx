import Link from "next/link";
import { getDatabase } from "@/lib/db/client";
import {
  getEntryPage,
  getProjectByShareSlug,
  listPages,
} from "@/lib/db/queries";
import { SharePlayer } from "@/components/share-player";
import { toPageDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SharedPrototypePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDatabase();
  const project = getProjectByShareSlug(db, slug);

  if (!project) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This prototype is no longer available.
        </h1>
        <p className="text-slate-600">
          The owner may have revoked the share link, or it never existed.
        </p>
      </main>
    );
  }

  const pages = listPages(db, project.id);
  const entry = getEntryPage(db, project.id) ?? pages[0];

  if (!entry) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This prototype has no pages yet.
        </h1>
        <Link href="/" className="font-medium underline">
          Go to mockable
        </Link>
      </main>
    );
  }

  return (
    <SharePlayer
      projectName={project.name}
      pages={pages.map(toPageDTO)}
      initialPageId={entry.id}
    />
  );
}
