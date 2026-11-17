import { describe, expect, it } from "vitest";
import {
  HTML_RULES,
  LAYOUT_ARCHETYPES,
  buildNewPagePrompt,
  buildProposalPrompt,
  buildRefinePrompt,
} from "@/lib/llm/prompts";

const PAGES = [
  { name: "home", title: "Home", isEntry: true },
  { name: "settings", title: "Settings", isEntry: false },
];

function combined(prompt: { system: string; prompt: string }): string {
  return `${prompt.system}\n${prompt.prompt}`;
}

function expectCoreConstraints(text: string) {
  expect(text).toMatch(/self-contained/i);
  expect(text).toMatch(/no external dependencies/i);
  expect(text).toMatch(/No JavaScript/i);
  expect(text).toMatch(/<script>/i);
  expect(text).toMatch(/page:\/\//);
  expect(text).toMatch(/complete HTML document/i);
}

describe("HTML_RULES", () => {
  it("states the self-contained, no-script, page-link constraints", () => {
    expectCoreConstraints(HTML_RULES);
  });
});

describe("buildProposalPrompt", () => {
  it("has five archetypes with distinct directives", () => {
    expect(LAYOUT_ARCHETYPES).toHaveLength(5);
    const directives = new Set(LAYOUT_ARCHETYPES.map((a) => a.directive));
    expect(directives.size).toBe(5);
  });

  it.each(LAYOUT_ARCHETYPES)(
    "includes the core constraints and $id layout for every variant",
    (archetype) => {
      const built = buildProposalPrompt({
        prompt: "A booking app for boutique hotels",
        archetype: archetype.id,
      });
      const text = combined(built);
      expectCoreConstraints(text);
      expect(built.archetype).toBe(archetype.id);
      expect(text).toContain(archetype.label);
      expect(text).toContain(archetype.directive);
      expect(text).toContain("A booking app for boutique hotels");
      expect(text).toMatch(/entry screen/i);
    },
  );
});

describe("buildRefinePrompt", () => {
  it("carries archetype consistency, the registry, and the current HTML", () => {
    const built = buildRefinePrompt({
      archetype: "sidebar-shell",
      pages: PAGES,
      currentPageName: "home",
      currentHtml: "<!DOCTYPE html><html><body>saved baseline</body></html>",
      message: "Add a prominent search field to the header",
    });
    const text = combined(built);
    expectCoreConstraints(text);
    expect(text).toMatch(/sidebar-shell/);
    expect(text).toMatch(/layout archetype/i);
    expect(text).toContain("page://settings");
    expect(text).toContain("saved baseline");
    expect(text).toContain("Add a prominent search field to the header");
    expect(text).toMatch(/ENTIRE current page/i);
  });
});

describe("buildNewPagePrompt", () => {
  it("includes the registry, entry excerpt, name, and description", () => {
    const built = buildNewPagePrompt({
      archetype: "master-detail",
      pages: PAGES,
      entryHtml: "<!DOCTYPE html><html><body>entry style marker</body></html>",
      name: "settings",
      description: "A settings page with account and notification sections",
    });
    const text = combined(built);
    expectCoreConstraints(text);
    expect(text).toMatch(/master-detail/);
    expect(text).toMatch(/layout archetype/i);
    expect(text).toContain("page://home");
    expect(text).toContain("entry style marker");
    expect(text).toContain("NEW PAGE NAME: settings");
    expect(text).toContain("account and notification sections");
  });
});
