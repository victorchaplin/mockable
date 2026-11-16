# Design

## Context

Greenfield repository — no existing code, only this OpenSpec scaffold. All behavior requirements live in the specs of this change; this document records how to build them. The product shape was explored before this change: a personal, single-user tool, self-hosted, no auth, BYOK LLM access, with a validated migration path to hosted Postgres (Neon/Turso) and auth (Auth.js) later.

## Goals / Non-Goals

**Goals:**

- One deployable full-stack Next.js app (App Router + route handlers) with a single SQLite file — fewest moving parts for a personal tool.
- Every mock artifact is real, self-contained HTML/CSS from the moment it is generated (code-first, not image-first).
- The server holds no secrets; BYOK keys live in the browser.
- Keep the app portable: no Vercel-specific or hard-to-exit features.

**Non-Goals:**

- Authentication, multi-user, teams, permissions (Auth.js is a documented bolt-on path, not built now).
- Server-side API keys or any key persistence server-side.
- Screenshot/image export (would need server-side headless browser; the pick grid shows live previews instead).
- Version history / snapshots for pages.
- JavaScript inside generated mocks (mocks stay static HTML/CSS; interactivity is flow navigation only).
- Feedback capture on share links (comments, analytics).

## Decisions

### D1: Single Next.js full-stack app, TypeScript everywhere

App Router for pages, route handlers for the API. One repo, one language, one deployable, no CORS.

**Portability discipline (binding for all code):** no server actions, no edge middleware, no `next/image`, no Vercel products (KV/Blob/Analytics), no cache-revalidation reliance. Route handlers use standard Web `Request`/`Response` signatures so they can move to Hono/Express with near-identical code; the React UI is plain client components that could move to any bundler. This keeps every exit path (Vite+Hono split, host change) cheap.

**Alternative considered:** Vite SPA + separate Hono API — same language but two processes and cross-origin setup with no benefit at this scale.

### D2: SQLite + Drizzle, boring SQL only

`better-sqlite3` as the driver, `DATABASE_URL=file:./mockable.db`. Schema (all ids are text UUIDs, timestamps as ISO text):

- `generations(id, prompt, created_at)` — one row per "prompt → 5 proposals" run.
- `proposals(id, generation_id, variant_index 1-5, archetype, html, created_at, picked_at nullable)` — the five variants; `picked_at` set when chosen.
- `projects(id, name, prompt, archetype, share_slug unique nullable, created_at, updated_at)`.
- `pages(id, project_id, name unique-per-project, title, is_entry, html, position, created_at, updated_at)`.

Escape hatches (validated during exploration): Turso = same dialect, near-zero code change; Neon/Postgres = driver swap + minor column-type tweaks + one data migration. Only guaranteed if queries stay boring — no SQLite-specific JSON functions, no raw dialect SQL.

### D3: BYOK — key lives in the browser, server is a transient proxy

Settings UI stores `{provider, model, apiKey}` in `localStorage`. Every LLM-bound request sends them as headers (`x-llm-api-key`, `x-llm-provider`, `x-llm-model`). The server reads them, calls the provider via the Vercel AI SDK, and never writes them anywhere. Logging discipline: no request header/body logging in LLM routes; error traces redact these headers.

Provider registry is server-side code: a map of provider id → AI SDK provider instance (openai, anthropos, zai, google, openrouter at MVP), constructed per-request with the incoming key. Adding providers is code, not config. Defaults for the settings UI come from optional env vars; **no LLM key is ever an env var**.

### D4: Proposal generation — 5 parallel calls seeded by layout archetypes

`POST /api/generations` (SSE): server runs 5 parallel LLM calls. System prompt = shared base (self-contained HTML page, inline CSS, no external resources, no scripts, realistic legible content matching the user's prompt, in-flow links use the `page://<page-name>` scheme for the plausible next pages) + one archetype directive per variant: `sidebar-shell`, `top-nav-cards`, `dashboard-grid`, `wizard-stepper`, `master-detail`. Layout is the divergence axis; the base prompt pins styling to a tasteful, consistent default so variants are comparable.

Output is validated per variant: must parse as a single HTML document (strip markdown fences, require `<html`...`</html>`); one automatic retry with the validation error appended, then surface the variant as failed if it still fails. Each completed variant is persisted as a proposal and emitted as an SSE event, so the pick grid fills in progressively (cards appear as they finish, with per-variant pending/failed states).

**Alternative considered:** true AI image generation — rejected in exploration: image→code conversion is lossy and the picked artifact would not be the refined artifact.

### D5: Pick → project; refinement loop is full-page rewrite

Picking a proposal (`POST /api/projects/from-proposal`) creates the project (name derived from prompt, recorded `prompt` + `archetype`) and its entry page from the proposal HTML.

Refinement `POST /api/projects/:id/pages/:pageId/edit` (streams): prompt context = archetype + page registry (names of existing pages) + full current page HTML + user message → model returns the **entire updated page**. Full-page rewrite over diffs: simpler, self-correcting, avoids merge logic; page sizes stay manageable. On completion the client saves via the stream's final event and the preview re-renders. (Live token-streaming *into* the preview is a future polish, not MVP.)

**New pages** are an explicit mode (not chat-intent guessing): an "Add page" control in the pages section, and the missing-link affordance (D6). `POST /api/projects/:id/pages` generates a new page — prompt = archetype + existing pages' names + entry-page excerpt for style consistency + user's description of the new page → returns `{name, title, html}`.

### D6: Preview mechanics — sandboxed iframe + `page://` link interception

Mocks link between pages with `page://<page-name>`. The app injects a small, app-controlled runtime script into the page HTML **at render time** (never generated by the LLM) that intercepts clicks: `page://` links postMessage the target name to the parent; external http(s) links are opened in a new tab by the parent; everything else is left alone.

- **Editor preview:** `<iframe sandbox="allow-scripts">` (deliberately *without* `allow-same-origin`) + `srcdoc`. Parent swaps `srcdoc` on page messages. A `page://` target that doesn't exist in the project posts to the parent, which shows the "create page 'X'?" affordance (D5 add-page mode).
- **Share player (`/p/[slug]`):** a server component loads project + pages, embeds them as JSON in the page, and the same iframe-swap mechanism runs fully client-side with zero API calls. Player chrome: project name + page switcher; nothing else. Revoking = clearing `share_slug`; the route then renders "no longer available".
- **Pick grid previews:** the same sandboxed iframe at reduced scale (`transform: scale()`, pointer-events on), one per variant — live pages, not screenshots.

Sandbox rationale: `allow-scripts` without `allow-same-origin` keeps the iframe origin-isolated (no DOM/storage access to the app) while allowing the injected runtime; the LLM's HTML itself is script-free and displayed as-is otherwise.

### D7: Styling — two worlds

The app's own chrome uses Tailwind. Generated mocks must be dependency-free: system fonts, inline CSS, no CDN frameworks, no external images (inline SVG/SVG data URIs/emoji/CSS art only). This keeps mocks portable, shareable, and inspectable, and makes "no external requests" enforceable.

### D8: Environment variables

`example.env` at repo root documents every variable; `.env` is gitignored. **No LLM key exists in the environment** (BYOK — D3):

```
# SQLite database file (Drizzle)
DATABASE_URL="file:./mockable.db"

# Port for `next start` (self-hosted)
PORT=3000

# Public base URL of the app, used to build share links
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# --- LLM (BYOK) -----------------------------------------------------------
# API keys are NOT set here. Users paste their own key in the app's Settings
# UI; it is stored in the browser (localStorage) only and sent per request.
# These optional vars only provide the defaults offered in Settings:

# NEXT_PUBLIC_DEFAULT_LLM_PROVIDER="openai"
# NEXT_PUBLIC_DEFAULT_LLM_MODEL="gpt-4o"
```

### App structure

```
mockable/
  app/
    page.tsx                 # projects home
    new/page.tsx             # prompt -> proposals -> pick
    project/[id]/page.tsx    # editor (chat + preview + code panel)
    p/[slug]/page.tsx        # public share player
    settings/page.tsx        # BYOK settings
    api/
      generations/route.ts   # POST prompt -> SSE, 5 proposals
      projects/...           # CRUD, from-proposal, share, pages, edit
  lib/
    db/                      # drizzle schema, client, migrations
    llm/                     # provider registry, prompt builders, HTML validation
    preview/                  # runtime injection, link interception helpers
  components/                 # editor panes, pick grid, settings dialog
  example.env
```

## Risks / Trade-offs

- [LLM returns invalid or wrapped HTML] → validator strips fences and checks structure; one auto-retry with error feedback; failed variants surface a retry button instead of breaking the batch.
- [5 parallel full-page generations take 30-60s] → per-variant SSE completion events fill the grid progressively; variants are independent so one slow/failing call never blocks the others.
- [Prompt injection via generated content] → mocks render in a sandboxed iframe without `allow-same-origin`, with no app-origin access; LLM HTML is treated as untrusted display data, never executed outside the sandbox.
- [Key leakage through logs or errors] → LLM routes never log headers/bodies; provider errors are mapped to safe user-facing messages (D3); key exists only in browser storage and transient request scope.
- [SQLite single-writer / no cross-device access] → acceptable for a single-user personal tool; the Neon/Turso migration path (D2) is the documented upgrade, not new design.
- [Full-page rewrite loses user's manual code edits on chat turns] → chat context includes the *current saved* HTML (manual edits included), so edits are the baseline the model rewrites; acceptable for MVP, version history would fully solve it (Non-Goal).
- [`page://` links to pages the model never creates] → clicking them surfaces the create-page affordance, which is also the intended growth mechanism — feature, not failure.

## Migration Plan

Greenfield — no rollout or data migration. Deploy: Node host with a persistent volume (VPS/Railway/Fly), clone, copy `example.env` → `.env`, `npm install`, run migrations, `next build && next start`. Rollback: `git revert` + redeploy; SQLite file is a single copyable artifact (back up by copying the file). Future DB swap (Neon/Turso): add driver package, change `DATABASE_URL`, adjust minor column types, run the one-time data migration script — no app-layer query changes.

## Open Questions

None blocking. Deferred safely: the default provider/model shown in Settings (env-overridable, chosen at apply time); live token-streaming into the preview during refinement (post-MVP polish); additional provider ids beyond the initial registry (code addition whenever needed).
