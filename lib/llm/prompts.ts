/**
 * Prompt builders (design D4/D5). Layout is the divergence axis; the style
 * rules are shared across every prompt so the five proposals stay comparable.
 */

import {
  LAYOUT_ARCHETYPES,
  getArchetype,
  type LayoutArchetypeId,
} from "./archetypes";

export {
  LAYOUT_ARCHETYPES,
  getArchetype,
  type LayoutArchetype,
  type LayoutArchetypeId,
} from "./archetypes";

/** Shared hard rules that every generated page must obey. */
export const HTML_RULES = `You write hand-crafted, self-contained HTML/CSS mockups of product screens.

HARD RULES — every response must follow all of them:
1. Return exactly one complete HTML document: start with <!DOCTYPE html> and end with </html>. No commentary, no markdown fences, no surrounding prose.
2. Everything is self-contained: all CSS lives in a single <style> tag in <head>. There are no external dependencies — no CDN scripts, no external stylesheets, no web fonts, no external images, no network requests. Use system font stacks, inline SVG, CSS gradients/shapes, and emoji instead.
3. No JavaScript: never include <script> tags, inline event handlers (onclick, onsubmit, ...), or javascript: URLs. The page is static HTML/CSS.
4. Render realistic, legible content for the described product: real-looking labels, headings, names, numbers, prices, dates, and short copy. Never use lorem ipsum or placeholder boxes where text belongs.
5. In-flow navigation links must reference other mock pages by name using href="page://<page-name>", for example href="page://settings" or href="page://checkout". Do not use # anchors for primary navigation. Only use external http(s) links for genuinely external references.
6. Design for a 1280x800 desktop viewport first, but keep the layout usable when the viewport shrinks (responsive CSS is allowed).
7. Use accessible contrast, visible focus styling, semantic HTML, and sensible heading order.
8. Choose a tasteful, consistent visual style (neutral surfaces, one accent color, generous spacing, rounded corners where appropriate) so the variants stay comparable: layout is the divergence axis, not styling.`;

export type ProposalPrompt = {
  archetype: LayoutArchetypeId;
  system: string;
  prompt: string;
};

/** Proposal generation prompt: shared base + one archetype directive. */
export function buildProposalPrompt(input: {
  prompt: string;
  archetype: LayoutArchetypeId;
}): ProposalPrompt {
  const archetype =
    getArchetype(input.archetype) ?? LAYOUT_ARCHETYPES[0];
  return {
    archetype: archetype.id,
    system: HTML_RULES,
    prompt: `Design the ENTRY screen for this product:

"""
${input.prompt.trim()}
"""

LAYOUT ARCHETYPE — ${archetype.label}: ${archetype.directive}

Produce one complete, self-contained HTML document. Build a plausible product shell (navigation, header, and entry-screen content) for the described app. Include links to the two or three most plausible next pages using the page:// scheme so the mock can grow into a flow.`,
  };
}

export type PromptContextPage = {
  name: string;
  title: string;
  isEntry: boolean;
};

function pageRegistry(pages: PromptContextPage[]): string {
  if (pages.length === 0) return "(no other pages yet)";
  return pages
    .map(
      (page) =>
        `- page://${page.name} — ${page.title}${page.isEntry ? " (entry page)" : ""}`,
    )
    .join("\n");
}

/** Full-page rewrite prompt used by chat refinement (design D5). */
export function buildRefinePrompt(input: {
  archetype: string;
  pages: PromptContextPage[];
  currentPageName: string;
  currentHtml: string;
  message: string;
}): { system: string; prompt: string } {
  return {
    system: `${HTML_RULES}

You are refining an existing mock page. Keep the project's layout archetype (${input.archetype}) and visual language. Preserve unrelated content and working page:// links unless the request changes them. When the user asks for links or flow changes, use the existing page registry and the page:// scheme.`,
    prompt: `PROJECT LAYOUT ARCHETYPE: ${input.archetype}

EXISTING PAGES (the page registry):
${pageRegistry(input.pages)}

CURRENT PAGE: page://${input.currentPageName}

CURRENT PAGE HTML (this is the saved baseline, including any manual edits):
\`\`\`html
${input.currentHtml}
\`\`\`

USER REQUEST:
${input.message.trim()}

Rewrite the ENTIRE current page to satisfy the request while keeping it a complete, self-contained HTML document in the same layout archetype. Return only the full updated HTML document.`,
  };
}

/** New-page generation prompt; reuses the entry page for style consistency. */
export function buildNewPagePrompt(input: {
  archetype: string;
  pages: PromptContextPage[];
  entryHtml: string;
  name: string;
  description: string;
}): { system: string; prompt: string } {
  return {
    system: `${HTML_RULES}

You are adding one page to an existing mock flow. Match the project's layout archetype (${input.archetype}) and the visual language of its entry page. Link back to existing pages with the page:// scheme where it makes sense.`,
    prompt: `PROJECT LAYOUT ARCHETYPE: ${input.archetype}

EXISTING PAGES (the page registry):
${pageRegistry(input.pages)}

ENTRY PAGE EXCERPT (for style consistency):
\`\`\`html
${input.entryHtml.slice(0, 6000)}
\`\`\`

NEW PAGE NAME: ${input.name}
NEW PAGE PURPOSE: ${input.description.trim() || "A natural next page in this flow."}

Create the new page as one complete, self-contained HTML document. It must share the existing navigation/shell style and layout archetype so it feels like the same product.`,
  };
}
