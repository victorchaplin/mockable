/**
 * Preview runtime (design D6).
 *
 * Mocks navigate with `page://<name>` links. The app injects this small,
 * app-controlled script at render time — never into the stored page HTML —
 * so clicks can be routed to the parent React app. The iframe is sandboxed
 * with `allow-scripts` and deliberately *without* `allow-same-origin`, so the
 * mock cannot touch the app's DOM or storage.
 */

export const PREVIEW_RUNTIME_MARKER = "data-mockable-runtime";

export const PREVIEW_RUNTIME_SCRIPT = `(function () {
  "use strict";
  function send(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*");
      } else {
        window.postMessage(message, "*");
      }
    } catch (error) {
      /* silently ignore */
    }
  }
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var link =
        target && target.closest ? target.closest("a[href]") : null;
      if (!link) return;
      var href = link.getAttribute("href") || "";
      if (href.indexOf("page://") === 0) {
        event.preventDefault();
        send({ type: "mockable:navigate", page: href.slice("page://".length) });
        return;
      }
      if (/^https?:\\/\\//i.test(href)) {
        event.preventDefault();
        send({ type: "mockable:external", url: href });
      }
    },
    true
  );
})();`;

/** Insert the runtime before `</body>` (or append when there is no body tag). */
export function injectPreviewRuntime(html: string): string {
  if (html.includes(PREVIEW_RUNTIME_MARKER)) return html;
  const script = `<script ${PREVIEW_RUNTIME_MARKER}>${PREVIEW_RUNTIME_SCRIPT}</script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${html}${script}`;
}

export type PreviewMessage =
  | { type: "mockable:navigate"; page: string }
  | { type: "mockable:external"; url: string };

export function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.type === "mockable:navigate" && typeof record.page === "string") {
    return { type: "mockable:navigate", page: record.page };
  }
  if (record.type === "mockable:external" && typeof record.url === "string") {
    if (!/^https?:\/\//i.test(record.url)) return null;
    return { type: "mockable:external", url: record.url };
  }
  return null;
}
