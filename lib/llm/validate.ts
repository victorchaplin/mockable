/**
 * HTML output validation (design D4). LLM output must be one complete HTML
 * document; markdown fences are tolerated and unwrapped, fragments and scripts
 * are rejected.
 */

export type HtmlValidationResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

/** Remove a surrounding ```html fence when the model adds one. */
export function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:html|HTML)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = trimmed.match(fence);
  return match ? match[1].trim() : trimmed;
}

export function validateHtml(raw: string): HtmlValidationResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "The model returned an empty response." };
  }

  const unfenced = stripMarkdownFences(raw);

  const startMatch = unfenced.match(/<!doctype html|<html[\s>]/i);
  if (!startMatch || startMatch.index === undefined) {
    return {
      ok: false,
      error:
        "The response was not a complete HTML document (missing <!DOCTYPE html> or <html>).",
    };
  }

  const endIndex = unfenced.toLowerCase().lastIndexOf("</html>");
  if (endIndex === -1) {
    return {
      ok: false,
      error:
        "The response was not a complete HTML document (missing closing </html>).",
    };
  }

  const html = unfenced
    .slice(startMatch.index, endIndex + "</html>".length)
    .trim();

  if (!/<body[\s>]/i.test(html)) {
    return {
      ok: false,
      error: "The HTML document has no <body> element.",
    };
  }

  if (/<script[\s>]/i.test(html)) {
    return {
      ok: false,
      error:
        "The generated page must not contain <script> tags; mocks are static HTML/CSS.",
    };
  }

  // Self-contained means no external resource loads (CDN styles, web fonts,
  // remote images, @import, CSS url(...) fetches). Plain http(s) anchor links
  // are allowed because they are content, not dependencies.
  const externalLoad = [
    /<link\b[^>]*\bhref\s*=\s*["']https?:\/\//i,
    /<(?:img|source|video|audio|iframe|embed|object)\b[^>]*\bsrc\s*=\s*["']https?:\/\//i,
    /url\(\s*["']?https?:\/\//i,
    /@import\s+(?:url\()?\s*["']?https?:\/\//i,
  ].find((pattern) => pattern.test(html));
  if (externalLoad) {
    return {
      ok: false,
      error:
        "The generated page loads external resources. Mocks must be self-contained: inline CSS, system fonts, inline SVG/data URIs only.",
    };
  }

  return { ok: true, html };
}
