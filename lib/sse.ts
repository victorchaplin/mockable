/**
 * Minimal SSE helpers that work in route handlers, the browser, and tests.
 * Route handlers use plain Web Request/Response signatures (design D1), so
 * nothing here depends on Next.js.
 */

export function encodeSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** Parse a complete SSE body into its JSON payloads (test/debug helper). */
export function parseSseEvents(text: string): unknown[] {
  const events: unknown[] = [];
  for (const block of text.split("\n\n")) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // ignore malformed blocks
    }
  }
  return events;
}

/** Consume a streaming SSE response and dispatch each JSON payload. */
export async function consumeSse(
  response: Response,
  onEvent: (data: unknown) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trimStart();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          // ignore malformed events rather than aborting the stream
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice("data:".length).trimStart();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        // ignore
      }
    }
  }
}
