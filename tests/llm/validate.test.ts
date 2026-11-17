import { describe, expect, it } from "vitest";
import {
  stripMarkdownFences,
  validateHtml,
} from "@/lib/llm/validate";

const CLEAN = `<!DOCTYPE html>
<html lang="en">
<head><style>body { margin: 0; }</style></head>
<body><h1>Dashboard</h1><a href="page://settings">Settings</a></body>
</html>`;

describe("stripMarkdownFences", () => {
  it("unwraps html fences", () => {
    expect(stripMarkdownFences("```html\n<div>x</div>\n```")).toBe(
      "<div>x</div>",
    );
    expect(stripMarkdownFences("```\n<div>x</div>\n```")).toBe("<div>x</div>");
  });

  it("leaves unfenced content alone", () => {
    expect(stripMarkdownFences("  <div>x</div>  ")).toBe("<div>x</div>");
  });
});

describe("validateHtml", () => {
  it("passes clean complete documents", () => {
    const result = validateHtml(CLEAN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(result.html.endsWith("</html>")).toBe(true);
    }
  });

  it("unwraps fenced HTML", () => {
    const result = validateHtml(`\`\`\`html\n${CLEAN}\n\`\`\``);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).not.toContain("```");
      expect(result.html).toContain("<h1>Dashboard</h1>");
    }
  });

  it("trims commentary around the document", () => {
    const result = validateHtml(`Here is the page:\n${CLEAN}\nHope this helps!`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html.startsWith("<!DOCTYPE html>")).toBe(true);
    }
  });

  it("rejects fragments", () => {
    const result = validateHtml("<div class='card'>Just a fragment</div>");
    expect(result.ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(validateHtml("I cannot help with that request.").ok).toBe(false);
    expect(validateHtml("").ok).toBe(false);
  });

  it("rejects documents that never close", () => {
    const result = validateHtml("<!DOCTYPE html><html><body><h1>Oops</h1>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/closing/i);
  });

  it("rejects generated scripts", () => {
    const result = validateHtml(
      "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/script/i);
  });

  it("rejects external resource loads but allows external anchor links", () => {
    const remoteImage = validateHtml(
      '<!DOCTYPE html><html><body><img src="https://example.com/a.png" /></body></html>',
    );
    expect(remoteImage.ok).toBe(false);

    const remoteStyle = validateHtml(
      '<!DOCTYPE html><html><head><link rel="stylesheet" href="https://cdn.example.com/x.css" /></head><body>x</body></html>',
    );
    expect(remoteStyle.ok).toBe(false);

    const cssUrl = validateHtml(
      '<!DOCTYPE html><html><head><style>body{background:url(https://x.test/bg.png)}</style></head><body>x</body></html>',
    );
    expect(cssUrl.ok).toBe(false);

    const anchor = validateHtml(
      '<!DOCTYPE html><html><body><a href="https://example.com/help">Help</a></body></html>',
    );
    expect(anchor.ok).toBe(true);
  });
});
