// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PreviewFrame } from "@/components/preview-frame";
import {
  PREVIEW_RUNTIME_MARKER,
  PREVIEW_RUNTIME_SCRIPT,
  injectPreviewRuntime,
  parsePreviewMessage,
} from "@/lib/preview/runtime";

const PAGE = `<!DOCTYPE html><html><body>
<h1>Orders</h1>
<a id="flow" href="page://settings">Settings</a>
<a id="external" href="https://example.com/help">Help</a>
</body></html>`;

describe("injectPreviewRuntime", () => {
  it("adds the runtime at render time without mutating stored HTML", () => {
    const injected = injectPreviewRuntime(PAGE);
    expect(injected).toContain(PREVIEW_RUNTIME_MARKER);
    expect(injected).toContain("page://");
    expect(PAGE).not.toContain(PREVIEW_RUNTIME_MARKER);
    expect(injected.indexOf(PREVIEW_RUNTIME_MARKER)).toBeLessThan(
      injected.indexOf("</body>"),
    );
  });

  it("does not double-inject", () => {
    const once = injectPreviewRuntime(PAGE);
    expect(injectPreviewRuntime(once)).toBe(once);
  });
});

describe("PreviewFrame", () => {
  it("sandboxes with allow-scripts but not allow-same-origin", () => {
    render(<PreviewFrame html={PAGE} title="Orders preview" />);
    const frame = screen.getByTestId("preview-frame");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain(PREVIEW_RUNTIME_MARKER);
  });

  it("calls onNavigate for page:// messages", async () => {
    const onNavigate = vi.fn();
    render(
      <PreviewFrame html={PAGE} title="Orders preview" onNavigate={onNavigate} />,
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "mockable:navigate", page: "settings" },
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("opens external links in a new tab from the parent", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<PreviewFrame html={PAGE} title="Orders preview" />);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "mockable:external", url: "https://example.com/help" },
      }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://example.com/help",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});

describe("injected runtime script", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function evaluateRuntime() {
    new Function(PREVIEW_RUNTIME_SCRIPT)();
  }

  it("intercepts in-flow page:// links and posts to the parent", async () => {
    document.body.innerHTML =
      '<a id="flow" href="page://checkout">Checkout</a>';
    const received: unknown[] = [];
    window.addEventListener("message", (event) => received.push(event.data));
    evaluateRuntime();

    const link = document.getElementById("flow") as HTMLAnchorElement;
    link.click();

    await waitFor(() =>
      expect(received).toContainEqual({
        type: "mockable:navigate",
        page: "checkout",
      }),
    );
  });

  it("intercepts external http links and posts them", async () => {
    document.body.innerHTML =
      '<a id="ext" href="https://example.com/docs">Docs</a>';
    const received: unknown[] = [];
    window.addEventListener("message", (event) => received.push(event.data));
    evaluateRuntime();

    (document.getElementById("ext") as HTMLAnchorElement).click();

    await waitFor(() =>
      expect(received).toContainEqual({
        type: "mockable:external",
        url: "https://example.com/docs",
      }),
    );
  });

  it("leaves other links alone", () => {
    document.body.innerHTML = '<a id="frag" href="#details">Details</a>';
    const received: unknown[] = [];
    window.addEventListener("message", (event) => received.push(event.data));
    evaluateRuntime();

    (document.getElementById("frag") as HTMLAnchorElement).click();
    expect(received).toHaveLength(0);
  });
});

describe("parsePreviewMessage", () => {
  it("accepts known message shapes and rejects others", () => {
    expect(
      parsePreviewMessage({ type: "mockable:navigate", page: "home" }),
    ).toEqual({ type: "mockable:navigate", page: "home" });
    expect(
      parsePreviewMessage({ type: "mockable:external", url: "https://x.test" }),
    ).toEqual({ type: "mockable:external", url: "https://x.test" });
    expect(
      parsePreviewMessage({ type: "mockable:external", url: "javascript:alert(1)" }),
    ).toBeNull();
    expect(parsePreviewMessage({ type: "other" })).toBeNull();
    expect(parsePreviewMessage("hello")).toBeNull();
  });
});
