/**
 * Deterministic stand-in for the LLM, used only when MOCKABLE_LLM=mock.
 * E2E tests run the real server and real database with this enabled so the
 * whole prompt -> proposals -> pick -> refine -> share flow can be exercised
 * without network access or an API key.
 */

export function isMockLlmEnabled(): boolean {
  return process.env.MOCKABLE_LLM === "mock";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractArchetype(prompt: string): string {
  const match = prompt.match(/LAYOUT ARCHETYPE — ([^:]+):/);
  return match ? match[1].trim() : "Mock page";
}

function extractUserPrompt(prompt: string): string {
  const match = prompt.match(/"""\n([\s\S]*?)\n"""/);
  return match ? match[1].trim() : "Your app";
}

function pageShell(input: {
  title: string;
  body: string;
  accent?: string;
}): string {
  const accent = input.accent ?? "#2563eb";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { --accent: ${accent}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    a { color: var(--accent); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .shell { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: #0f172a; color: white; padding: 24px; }
    .sidebar a { color: #cbd5e1; display: block; padding: 8px 0; }
    .main { flex: 1; padding: 40px; }
    .topnav { display: flex; gap: 24px; align-items: center; padding: 20px 40px; background: white; border-bottom: 1px solid #e2e8f0; }
    .topnav .brand { font-weight: 700; margin-right: auto; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 24px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
    .btn { display: inline-block; background: var(--accent); color: white; padding: 10px 18px; border-radius: 8px; }
    .muted { color: #64748b; }
    h1 { margin: 0 0 8px; font-size: 32px; }
  </style>
</head>
<body>
${input.body}
</body>
</html>`;
}

/** Entry-screen proposal for one layout archetype. */
export function mockProposalHtml(prompt: string): string {
  const archetype = extractArchetype(prompt);
  const description = extractUserPrompt(prompt);
  const short = description.slice(0, 120);

  if (/Sidebar shell/i.test(archetype)) {
    return pageShell({
      title: `${archetype} entry`,
      body: `<div class="shell">
  <aside class="sidebar">
    <div style="font-weight:700;font-size:18px;margin-bottom:24px">Mockable App</div>
    <a href="page://home">Overview</a>
    <a href="page://settings">Settings</a>
    <a href="page://details">Details</a>
  </aside>
  <main class="main">
    <span class="badge">Sidebar shell variant</span>
    <h1>Overview</h1>
    <p class="muted">${escapeHtml(short)}</p>
    <div class="row">
      <a class="btn" href="page://details">Open details</a>
      <a href="page://settings">Manage settings</a>
    </div>
    <div class="cards">
      <div class="card"><h2>Today</h2><p class="muted">12 active orders</p></div>
      <div class="card"><h2>Revenue</h2><p class="muted">$4,280 this week</p></div>
      <div class="card"><h2>Team</h2><p class="muted">4 people online</p></div>
    </div>
  </main>
</div>`,
    });
  }

  if (/Top nav/i.test(archetype)) {
    return pageShell({
      title: `${archetype} entry`,
      accent: "#0f766e",
      body: `<header class="topnav">
  <span class="brand">Mockable App</span>
  <a href="page://home">Home</a>
  <a href="page://details">Details</a>
  <a href="page://settings">Settings</a>
</header>
<main class="main">
  <span class="badge">Top nav + cards variant</span>
  <h1>Welcome back</h1>
  <p class="muted">${escapeHtml(short)}</p>
  <div class="cards">
    <div class="card"><h2>Start here</h2><p class="muted">Pick up where you left off.</p><a href="page://details">Open details →</a></div>
    <div class="card"><h2>Explore</h2><p class="muted">Browse the latest activity.</p></div>
    <div class="card"><h2>Configure</h2><p class="muted">Adjust your workspace.</p><a href="page://settings">Settings →</a></div>
  </div>
</main>`,
    });
  }

  if (/Dashboard/i.test(archetype)) {
    return pageShell({
      title: `${archetype} entry`,
      accent: "#7c3aed",
      body: `<main class="main">
  <span class="badge">Dashboard grid variant</span>
  <h1>Operations dashboard</h1>
  <p class="muted">${escapeHtml(short)}</p>
  <div class="cards">
    <div class="card"><h2>Orders</h2><p style="font-size:28px;margin:0">128</p><p class="muted">+12% vs last week</p></div>
    <div class="card"><h2>Latency</h2><p style="font-size:28px;margin:0">184ms</p><p class="muted">within target</p></div>
    <div class="card"><h2>Errors</h2><p style="font-size:28px;margin:0">0.4%</p><p class="muted">-0.1% today</p></div>
    <div class="card"><h2>Next step</h2><p class="muted">Review the queue.</p><a href="page://details">Details →</a></div>
  </div>
  <p style="margin-top:24px"><a href="page://settings">Settings</a></p>
</main>`,
    });
  }

  if (/Wizard/i.test(archetype)) {
    return pageShell({
      title: `${archetype} entry`,
      accent: "#b45309",
      body: `<main class="main" style="max-width:820px;margin:0 auto">
  <span class="badge">Wizard / stepper variant</span>
  <h1>Get started</h1>
  <p class="muted">${escapeHtml(short)}</p>
  <div class="row">
    <span class="badge">1. Profile</span>
    <span class="badge" style="background:#f1f5f9;color:#475569">2. Details</span>
    <span class="badge" style="background:#f1f5f9;color:#475569">3. Review</span>
  </div>
  <div class="card" style="margin-top:24px">
    <h2>Tell us about yourself</h2>
    <p class="muted">We use this to tailor your experience.</p>
    <div class="row"><a class="btn" href="page://details">Continue</a><a href="page://settings">Settings</a></div>
  </div>
</main>`,
    });
  }

  return pageShell({
    title: `${archetype} entry`,
    accent: "#be123c",
    body: `<div class="shell">
  <main class="main" style="max-width:720px">
    <span class="badge">Master-detail variant</span>
    <h1>Inbox</h1>
    <p class="muted">${escapeHtml(short)}</p>
    <p><a href="page://details">Open the first item</a> · <a href="page://settings">Settings</a></p>
  </main>
  <aside class="main" style="max-width:420px;border-left:1px solid #e2e8f0;background:white">
    <h2>Order #1042</h2>
    <p class="muted">Selected item detail pane.</p>
  </aside>
</div>`,
  });
}

function extractMessage(prompt: string): string {
  const match = prompt.match(/USER REQUEST:\n([\s\S]*?)\n\nRewrite/);
  return match ? match[1].trim() : "Adjust the layout";
}

function extractCurrentHtml(prompt: string): string {
  const match = prompt.match(
    /CURRENT PAGE HTML \(this is the saved baseline, including any manual edits\):\n```html\n([\s\S]*?)\n```/,
  );
  return match ? match[1] : "";
}

function extractNewPage(prompt: string): { name: string; purpose: string } {
  const name = prompt.match(/NEW PAGE NAME: ([^\n]+)/)?.[1]?.trim() ?? "page";
  const purpose =
    prompt.match(/NEW PAGE PURPOSE: ([^\n]+)/)?.[1]?.trim() ?? "";
  return { name, purpose };
}

/** Test-mode replacement for `generateText`; returns plausible HTML. */
export function mockGenerateText(input: {
  system: string;
  prompt: string;
}): string {
  const { prompt } = input;

  if (prompt.includes("NEW PAGE NAME:")) {
    const { name, purpose } = extractNewPage(prompt);
    return pageShell({
      title: name,
      body: `<div class="shell">
  <aside class="sidebar">
    <div style="font-weight:700;font-size:18px;margin-bottom:24px">Mockable App</div>
    <a href="page://home">Home</a>
    <a href="page://${escapeHtml(name)}">${escapeHtml(name)}</a>
  </aside>
  <main class="main">
    <span class="badge">New page</span>
    <h1>${escapeHtml(name)}</h1>
    <p class="muted">${escapeHtml(purpose || "A natural next page in this flow.")}</p>
    <p><a href="page://home">Back to home</a></p>
  </main>
</div>`,
    });
  }

  if (prompt.includes("CURRENT PAGE HTML")) {
    const current = extractCurrentHtml(prompt);
    const message = extractMessage(prompt);
    const banner = `<div id="mockable-refine" style="margin:24px;padding:16px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px">Refinement applied: ${escapeHtml(message)}</div>`;
    if (!current) return mockProposalHtml(prompt);
    if (/<\/body>/i.test(current)) {
      return current.replace(/<\/body>/i, `${banner}</body>`);
    }
    return `${current}${banner}`;
  }

  return mockProposalHtml(prompt);
}
