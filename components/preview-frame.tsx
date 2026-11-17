"use client";

import { useEffect } from "react";
import {
  injectPreviewRuntime,
  parsePreviewMessage,
} from "@/lib/preview/runtime";

type PreviewFrameProps = {
  html: string;
  title: string;
  className?: string;
  /** Render at desktop size and scale down, e.g. for the pick grid. */
  scale?: number;
  onNavigate?: (page: string) => void;
  onExternal?: (url: string) => void;
};

export function PreviewFrame({
  html,
  title,
  className = "",
  scale,
  onNavigate,
  onExternal,
}: PreviewFrameProps) {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = parsePreviewMessage(event.data);
      if (!message) return;
      if (message.type === "mockable:navigate") {
        onNavigate?.(message.page);
      } else {
        window.open(message.url, "_blank", "noopener,noreferrer");
        onExternal?.(message.url);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onNavigate, onExternal]);

  // srcDoc gets a fresh runtime injection on every render. The stored page HTML
  // never contains the runtime; only this rendered copy does.
  const srcDoc = injectPreviewRuntime(html);

  if (scale !== undefined) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ height: 800 * scale }}
      >
        <iframe
          title={title}
          data-testid="preview-frame"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{
            display: "block",
            width: 1280,
            height: 800,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "auto",
          }}
        />
      </div>
    );
  }

  return (
    <iframe
      title={title}
      data-testid="preview-frame"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className={`h-full w-full border-0 bg-white ${className}`}
    />
  );
}
