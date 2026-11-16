# Proposal

## Why

Choosing the right UX/UI before building an app is currently a gamble: static mockups don't test real navigation, and full code tools (Lovable/v0-style) converge on one design before you've compared alternatives. This change builds **mockable**, a tool that generates 5 layout-divergent, testable HTML/CSS mock proposals from one prompt, lets you refine the pick into a multi-page clickable prototype, and share it with teammates for feedback — so the best UX wins before any real code is written.

## What Changes

- New greenfield application (no existing code is modified): a self-hosted Next.js full-stack app.
- **Prompt to 5 layout proposals**: from a single natural-language prompt, generate 5 variants of the entry screen, each seeded with a different layout archetype (sidebar shell, top nav + cards, dashboard grid, wizard/stepper, master-detail). Divergence is on layout, not styling. Proposals are presented as live, scaled previews of real HTML/CSS — not static images.
- **Pick one, grow the flow**: the selected proposal becomes a project; the refinement loop adds and edits pages to build a multi-page flow consistent with the picked layout.
- **Refinement editor**: chat pane + live preview side by side, a toggleable HTML/CSS code panel for direct edits, and multi-page navigation inside the preview.
- **Shareable prototypes**: public share links render the full flow as an interactive player (click-through, no login, no auth).
- **Bring-your-own-key (BYOK) LLM access**: users paste their own API key in a settings UI; keys live in the browser only and are passed per request. The server holds no secrets and persists no keys.
- **Projects home**: create, open, rename, and delete mock projects.

## Capabilities

### New Capabilities

- `mock-generation`: Turn a natural-language prompt into 5 layout-divergent HTML/CSS entry-screen proposals, let the user compare them as live previews, and start a project from the chosen one.
- `prototype-refinement`: Refine a project into a multi-page flow via a chat + live-preview editor, with direct HTML/CSS editing and organic page growth.
- `prototype-sharing`: Publish a project's flow as a public, interactive, no-login share link; revoke sharing.
- `llm-byok`: Configure LLM access with a user-supplied API key stored browser-side and passed per request; provider-agnostic server-side proxy that never persists keys.
- `project-workspace`: Manage mock projects (list, open, rename, delete) from a projects home.

### Modified Capabilities

None — this is the first change in an empty repository; all capabilities are new.

## Impact

- **Code**: entire app is new — Next.js (App Router, TypeScript) with route handlers as the API, Drizzle ORM over SQLite (file storage, self-hosted with a persistent disk).
- **Dependencies**: next, react, drizzle-orm, better-sqlite3, Vercel AI SDK (`ai` + provider packages), tailwindcss.
- **Systems**: external LLM provider APIs reached with the user's own key; no other external services.
- **Portability constraints (by design)**: no server actions, no edge middleware, no `next/image`, no Vercel-specific products — keeping the app deployable on any Node host and the future DB swap (Turso/Neon) cheap.
- **Out of scope**: authentication/multi-user, server-side key storage, screenshot/image export, version history, in-share commenting/feedback capture.
