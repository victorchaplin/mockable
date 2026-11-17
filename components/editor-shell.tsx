"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { canonicalPageName } from "@/lib/page-name";
import { MissingLlmSettingsError, llmFetch } from "@/lib/llm-client";
import { consumeSse } from "@/lib/sse";
import type { EditorEvent, PageDTO, ProjectDTO } from "@/lib/types";
import { LlmSettingsNotice } from "@/components/llm-settings-notice";
import { PreviewFrame } from "@/components/preview-frame";

type ChatMessage = { id: number; role: "user" | "assistant"; text: string };

type EditorShellProps = {
  project: ProjectDTO;
  pages: PageDTO[];
  initialPageId?: string;
};

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || `Request failed (${response.status}).`;
}

export function EditorShell({
  project,
  pages: initialPages,
  initialPageId,
}: EditorShellProps) {
  const [pages, setPages] = useState<PageDTO[]>(initialPages);
  const [currentPageId, setCurrentPageId] = useState(
    initialPageId ?? initialPages[0]?.id ?? "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      text: "Describe a change to the current page, or ask me to add a new page (for example: “add a settings page”).",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsNeeded, setSettingsNeeded] = useState(false);

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeStatus, setCodeStatus] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [missingPage, setMissingPage] = useState<string | null>(null);
  const [creatingMissing, setCreatingMissing] = useState(false);

  const [shareSlug, setShareSlug] = useState<string | null>(project.shareSlug);
  const [shareUrl, setShareUrl] = useState<string | null>(
    project.shareSlug ? `/p/${project.shareSlug}` : null,
  );
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const nextMessageId = useRef(1);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === currentPageId) ?? pages[0],
    [pages, currentPageId],
  );
  const currentPageHtml = currentPage?.html;
  const currentPageIdValue = currentPage?.id;

  useEffect(() => {
    if (codeOpen && currentPageHtml !== undefined) setCodeDraft(currentPageHtml);
  }, [codeOpen, currentPageHtml, currentPageIdValue]);

  useEffect(() => {
    if (shareSlug && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/p/${shareSlug}`);
    }
  }, [shareSlug]);

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((current) => [
      ...current,
      { id: nextMessageId.current++, role, text },
    ]);
  }

  function upsertPage(page: PageDTO) {
    setPages((current) =>
      current.some((entry) => entry.id === page.id)
        ? current.map((entry) => (entry.id === page.id ? page : entry))
        : [...current, page],
    );
  }

  function navigateTo(name: string) {
    const canonical = canonicalPageName(name);
    const target = pages.find((page) => page.name === canonical);
    if (target) {
      setCurrentPageId(target.id);
      setMissingPage(null);
    } else {
      setMissingPage(name);
    }
  }

  function selectPage(pageId: string) {
    setCurrentPageId(pageId);
    setCodeStatus(null);
  }

  async function handleShare() {
    setShareBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/share`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        slug?: string;
        url?: string;
        error?: string;
      };
      if (!response.ok || !data.slug) {
        throw new Error(data.error || "Could not create a share link.");
      }
      setShareSlug(data.slug);
      setShareUrl(data.url ?? `/p/${data.slug}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sharing failed.");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevoke() {
    setShareBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/share`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readError(response));
      setShareSlug(null);
      setShareUrl(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Revoke failed.");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy automatically. Select the link and copy it.");
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy || !currentPage) return;

    setInput("");
    setError(null);
    setSettingsNeeded(false);
    addMessage("user", message);
    setBusy(true);
    setBusyText("Thinking…");

    try {
      const response = await llmFetch(
        `/api/projects/${project.id}/pages/${currentPage.id}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));

      await consumeSse(response, (raw) => {
        const editorEvent = raw as EditorEvent;
        if (editorEvent.type === "status") {
          setBusyText(editorEvent.message);
        } else if (editorEvent.type === "page") {
          upsertPage(editorEvent.page);
          addMessage("assistant", "Updated the page. The preview reflects the new version.");
        } else if (editorEvent.type === "page_created") {
          upsertPage(editorEvent.page);
          setCurrentPageId(editorEvent.page.id);
          setMissingPage(null);
          addMessage(
            "assistant",
            `Created the “${editorEvent.page.title}” page and opened it.`,
          );
        } else if (editorEvent.type === "error") {
          setError(editorEvent.error);
        }
      });
    } catch (caught) {
      if (caught instanceof MissingLlmSettingsError) {
        setSettingsNeeded(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Refinement failed.");
      }
    } finally {
      setBusy(false);
      setBusyText(null);
    }
  }

  async function createPage(input: {
    name: string;
    description: string;
    selecting: boolean;
  }): Promise<PageDTO> {
    const response = await llmFetch(`/api/projects/${project.id}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      page?: PageDTO;
      error?: string;
    };
    if (!response.ok || !data.page) {
      throw new Error(data.error || "Could not create the page.");
    }
    upsertPage(data.page);
    if (input.selecting) setCurrentPageId(data.page.id);
    return data.page;
  }

  async function submitAddPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addName.trim() || addBusy) return;
    setAddBusy(true);
    setError(null);
    setSettingsNeeded(false);
    try {
      const page = await createPage({
        name: addName,
        description: addDescription,
        selecting: true,
      });
      addMessage("assistant", `Created the “${page.title}” page.`);
      setAddOpen(false);
      setAddName("");
      setAddDescription("");
    } catch (caught) {
      if (caught instanceof MissingLlmSettingsError) {
        setSettingsNeeded(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Could not add page.");
      }
    } finally {
      setAddBusy(false);
    }
  }

  async function createMissingPage() {
    if (!missingPage || creatingMissing) return;
    setCreatingMissing(true);
    setError(null);
    setSettingsNeeded(false);
    try {
      const page = await createPage({
        name: missingPage,
        description: `Create the “${missingPage}” page linked from the “${currentPage?.name ?? "current"}” mock.`,
        selecting: true,
      });
      addMessage("assistant", `Created the “${page.title}” page. Its link now resolves.`);
      setMissingPage(null);
    } catch (caught) {
      if (caught instanceof MissingLlmSettingsError) {
        setSettingsNeeded(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Could not create page.");
      }
    } finally {
      setCreatingMissing(false);
    }
  }

  async function saveCode() {
    if (!currentPage || codeBusy) return;
    setCodeBusy(true);
    setCodeStatus(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${project.id}/pages/${currentPage.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: codeDraft }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        page?: PageDTO;
        error?: string;
      };
      if (!response.ok || !data.page) {
        throw new Error(data.error || "Could not save the page.");
      }
      upsertPage(data.page);
      setCodeStatus("Saved. The preview has been refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setCodeBusy(false);
    }
  }

  if (!currentPage) {
    return (
      <main className="p-8">
        <p className="text-slate-600">This project has no pages.</p>
        <Link href="/" className="font-medium underline">
          Back to projects
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Projects
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {project.archetype}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {shareSlug ? (
            <>
              <input
                aria-label="Share link"
                readOnly
                value={shareUrl ?? ""}
                onFocus={(event) => event.currentTarget.select()}
                className="w-72 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={shareBusy}
                className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleShare}
              disabled={shareBusy}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {shareBusy ? "Sharing…" : "Share"}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Refinement chat"
          className="flex w-full flex-col gap-3 border-b border-slate-200 bg-white p-4 lg:w-[380px] lg:border-b-0 lg:border-r"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Refine with chat
          </h2>

          {settingsNeeded ? <LlmSettingsNotice /> : null}

          <div
            role="log"
            aria-label="Chat messages"
            className="flex max-h-[420px] flex-1 flex-col gap-3 overflow-y-auto text-sm"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "self-end rounded-lg bg-slate-900 px-3 py-2 text-white"
                    : "self-start rounded-lg bg-slate-100 px-3 py-2 text-slate-700"
                }
              >
                {message.text}
              </div>
            ))}
            {busyText ? (
              <div className="self-start rounded-lg bg-slate-100 px-3 py-2 text-slate-500">
                {busyText}
              </div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="flex flex-col gap-2">
            <label htmlFor="refinement-message" className="sr-only">
              Refinement request
            </label>
            <textarea
              id="refinement-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              placeholder="Make the header more prominent, or add a settings page…"
              className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Working…" : "Send"}
            </button>
          </form>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900"
            >
              {error}{" "}
              <Link href="/settings" className="font-medium underline">
                Open Settings
              </Link>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-3">
            {addOpen ? (
              <form
                onSubmit={submitAddPage}
                aria-label="Add a page"
                className="flex flex-col gap-2"
              >
                <label htmlFor="new-page-name" className="text-sm font-medium">
                  New page name
                </label>
                <input
                  id="new-page-name"
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  placeholder="settings"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
                <label
                  htmlFor="new-page-description"
                  className="text-sm font-medium"
                >
                  New page description
                </label>
                <textarea
                  id="new-page-description"
                  value={addDescription}
                  onChange={(event) => setAddDescription(event.target.value)}
                  rows={2}
                  placeholder="Account and notification settings"
                  className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={addBusy || !addName.trim()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {addBusy ? "Creating…" : "Create page"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
              >
                Add page
              </button>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
            <nav aria-label="Pages" className="flex flex-wrap items-center gap-1">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => selectPage(page.id)}
                  aria-current={page.id === currentPage.id ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    page.id === currentPage.id
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {page.title}
                  {page.isEntry ? (
                    <span className="ml-1 text-xs opacity-70">(entry)</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                setCodeOpen((open) => !open);
                setCodeStatus(null);
              }}
              className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            >
              {codeOpen ? "Hide code" : "Code"}
            </button>
          </div>

          {missingPage ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>
                The preview links to “{missingPage}”, which does not exist yet.
              </span>
              <button
                type="button"
                onClick={createMissingPage}
                disabled={creatingMissing}
                className="rounded-md bg-amber-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {creatingMissing ? "Creating…" : `Create page “${missingPage}”?`}
              </button>
              <button
                type="button"
                onClick={() => setMissingPage(null)}
                className="text-sm font-medium underline"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="min-h-[420px] flex-1 bg-white">
            <PreviewFrame
              html={currentPage.html}
              title={`Live preview: ${currentPage.title}`}
              onNavigate={navigateTo}
            />
          </div>

          {codeOpen ? (
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-900 p-4 text-slate-100">
              <label htmlFor="page-code" className="text-sm font-medium">
                Page HTML
              </label>
              <textarea
                id="page-code"
                value={codeDraft}
                onChange={(event) => {
                  setCodeDraft(event.target.value);
                  setCodeStatus(null);
                }}
                spellCheck={false}
                rows={14}
                className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-100 outline-none focus:border-slate-400"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveCode}
                  disabled={codeBusy}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                >
                  {codeBusy ? "Saving…" : "Save code"}
                </button>
                {codeStatus ? (
                  <span role="status" className="text-sm text-emerald-300">
                    {codeStatus}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
