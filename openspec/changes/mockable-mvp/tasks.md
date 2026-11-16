# Tasks

## 1. Scaffold & environment

- [ ] 1.1 Scaffold the Next.js app (App Router, TypeScript, Tailwind, ESLint) with the `app/`, `lib/`, `components/` structure from design and verify `next dev` serves the placeholder home page
- [ ] 1.2 Create `example.env` at repo root with the exact contents from design (D8), ensure `.env` is gitignored and loaded, and verify the app boots reading `DATABASE_URL` and fails with a clear message when it is missing
- [ ] 1.3 Write the README quickstart (copy `example.env` → `.env`, install, dev, build, deploy with persistent-disk note) and verify each documented command runs as written
- [ ] 1.4 Enforce the portability discipline (no server actions, edge middleware, `next/image`, or Vercel products) via a grep-based check script and verify it passes on the scaffold

## 2. Data layer

- [ ] 2.1 Implement the Drizzle schema (`generations`, `proposals`, `projects`, `pages` per design D2) with migration config and verify `drizzle-kit` generates and runs migrations against a fresh SQLite file
- [ ] 2.2 Implement query helpers (project/page CRUD, generation + proposal persistence, per-project unique page names, share slug set/clear) and verify unit tests pass against a temp database

## 3. LLM layer (server)

- [ ] 3.1 Implement the provider registry with per-request provider instances built from request headers and verify unit tests: known provider builds, unknown provider rejects, key never appears in errors
- [ ] 3.2 Implement prompt builders (proposal base + 5 layout archetypes, refine, new-page) and verify unit tests assert the self-contained, no-scripts, `page://`-links, archetype-consistency constraints are present in each prompt
- [ ] 3.3 Implement HTML output validation (strip markdown fences, require a single complete document) and verify unit tests: clean HTML passes, fenced HTML is unwrapped, fragments/garbage fail
- [ ] 3.4 Implement key-error mapping (invalid/expired/quota → safe user-facing message pointing to settings, headers redacted from logs) and verify unit tests confirm mapped messages and absence of the key in output

## 4. Settings (BYOK client)

- [ ] 4.1 Implement the settings UI (provider, model, API key) persisting to localStorage with env-var defaults and verify a component test: save → reload → settings intact; key field masked
- [ ] 4.2 Implement the LLM request helper attaching `x-llm-api-key/provider/model` headers from saved settings and verify a component/network test shows headers present when set and requests blocked with a settings prompt when no key is saved

## 5. Generation & pick flow

- [ ] 5.1 Implement `POST /api/generations` as SSE: 5 parallel LLM calls with archetype seeds, per-variant completion events, invalid-output auto-retry, persistence of proposals, and verify a route test with a mocked LLM emits 5 events and isolates a failed variant
- [ ] 5.2 Implement the `/new` flow: prompt form → progressive pick grid with 5 scaled live sandboxed previews (pending/failed states, per-variant retry) and verify with a mocked LLM that all 5 cards render and are interactive before picking
- [ ] 5.3 Implement `POST /api/projects/from-proposal` (project + entry page + recorded prompt/archetype) with redirect into the editor and verify an API test creates the project and marks the proposal picked

## 6. Editor: preview, pages, refinement

- [ ] 6.1 Implement the sandboxed preview iframe (`allow-scripts`, no `allow-same-origin`) with the injected click runtime (`page://` interception → parent, external links → new tab) and verify component tests: in-flow link swaps the page, external link opens a tab, injected runtime is not part of stored page HTML
- [ ] 6.2 Implement the editor shell (chat pane + live preview side by side, page tabs with entry marker, current-page state) and verify component tests render the shell with seeded pages and switch tabs
- [ ] 6.3 Implement the code panel (view/edit current page HTML/CSS, save) and verify a test that a manual edit persists, appears in the code panel after reload, and re-renders the preview
- [ ] 6.4 Implement `POST /api/projects/:id/pages/:pageId/edit` (streamed full-page rewrite with archetype + page registry + current HTML context) and verify a route test with a mocked LLM saves the updated page and the preview reflects it
- [ ] 6.5 Implement add-page: `POST /api/projects/:id/pages` (consistency context), "Add page" control, and the missing-link "create page 'X'?" affordance in the editor, and verify tests: new page appears as a tab, previously unresolved `page://` links resolve after creation

## 7. Sharing

- [ ] 7.1 Implement share endpoints (create unique slug, revoke by clearing it) and verify API tests: share returns a URL, revoke clears it, revoked project no longer resolves
- [ ] 7.2 Implement the public player `/p/[slug]` (server component embedding pages JSON, client-side iframe swap, page switcher, no login, "no longer available" for missing/revoked) and verify an E2E test: open link → walk flow via in-flow links → revoke → link shows unavailable
- [ ] 7.3 Implement the Share UI in the editor (copyable link, revoke) and verify the link opens the player in a logged-out context and edits are reflected on reload of the link

## 8. Projects workspace

- [ ] 8.1 Implement the projects home (list with name, updated time, shared indicator; open on click; "new mock" entry) and verify component tests with seeded data show lists, badges, and navigation
- [ ] 8.2 Implement rename and delete-with-confirmation (cascade pages + revoke share) and verify API tests and a UI test that deletion requires confirmation and removes the project

## 9. Integration

- [ ] 9.1 Run the full mocked-LLM E2E happy path (prompt → 5 proposals → pick → chat refine → manual edit → add page → share → walk player → revoke) and verify it passes end-to-end
- [ ] 9.2 Verify the app boots from a clean clone using only `example.env` (no LLM key in env, settings prompt appears, non-LLM features work) and document any gaps found

## Workflow follow-up

- Archive the change after implementation is reviewed and complete (openspec-archive-change).
- Verify the archived specs land under `openspec/specs/` correctly.
