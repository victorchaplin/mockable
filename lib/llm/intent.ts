import { canonicalPageName } from "../page-name";
import type { PromptContextPage } from "./prompts";

/**
 * Chat-driven page growth (prototype-refinement spec). The design prefers an
 * explicit add-page mode, but the spec also requires that asking in chat for a
 * new page creates it. We detect only clear, named requests; everything else
 * is treated as a refinement of the current page.
 */
export function detectNewPageRequest(
  message: string,
): { name: string; description: string } | null {
  const patterns = [
    /\b(?:add|create|make|build|generate)\s+(?:a|an|the)?\s*page\s+(?:called|named|for)\s+([a-z0-9][a-z0-9 _/-]{0,40})/i,
    /\b(?:add|create|make|build|generate)\s+(?:a|an|the)?\s*(?:new\s+)?([a-z0-9][a-z0-9 _/-]{0,40}?)\s+page\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const raw = match[1].trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const name = canonicalPageName(raw);
    if (name === "page") continue;
    return { name, description: message.trim() };
  }
  return null;
}

export function registryFromPages(
  pages: Array<{ name: string; title: string; isEntry: boolean }>,
): PromptContextPage[] {
  return pages.map((page) => ({
    name: page.name,
    title: page.title,
    isEntry: page.isEntry,
  }));
}
