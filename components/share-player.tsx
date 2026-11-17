"use client";

import { useMemo, useState } from "react";
import { canonicalPageName } from "@/lib/page-name";
import type { PageDTO } from "@/lib/types";
import { PreviewFrame } from "@/components/preview-frame";

type SharePlayerProps = {
  projectName: string;
  pages: PageDTO[];
  initialPageId: string;
};

/**
 * Public, no-login flow player (design D6). The server embeds the pages JSON;
 * navigation and iframe swapping happen entirely client-side with no API calls.
 */
export function SharePlayer({
  projectName,
  pages,
  initialPageId,
}: SharePlayerProps) {
  const [currentPageId, setCurrentPageId] = useState(initialPageId);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === currentPageId) ?? pages[0],
    [pages, currentPageId],
  );

  function navigateTo(name: string) {
    const target = pages.find(
      (page) => page.name === canonicalPageName(name),
    );
    if (target) setCurrentPageId(target.id);
  }

  if (!currentPage) {
    return (
      <main className="p-8">
        <p>This prototype has no pages.</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <span className="text-sm font-semibold">{projectName}</span>
        <span className="text-xs text-slate-400">Prototype</span>
        <nav
          aria-label="Prototype pages"
          className="ml-auto flex flex-wrap items-center gap-1"
        >
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setCurrentPageId(page.id)}
              aria-current={page.id === currentPage.id ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                page.id === currentPage.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {page.title}
            </button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 bg-white">
        <PreviewFrame
          html={currentPage.html}
          title={`Prototype page: ${currentPage.title}`}
          onNavigate={navigateTo}
        />
      </div>
    </div>
  );
}
