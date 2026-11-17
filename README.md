# mockable

Turn a natural-language prompt into five layout-divergent, clickable HTML/CSS mock
proposals, refine the one you pick into a multi-page prototype, and share it with a
public link. Self-hosted, single-user, bring-your-own LLM key.

See `openspec/changes/mockable-mvp/` for the proposal, specs, and design.

## Quickstart

Requires Node.js 20+.

```bash
cp example.env .env
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000, then configure your LLM provider, model, and API key in
**Settings**. The key is stored in your browser's `localStorage` only; the server never
persists it.

## Scripts

```bash
npm run dev              # development server
npm run build            # production build
npm start                # production server (reads PORT from .env)
npm test                 # unit + component tests
npm run test:e2e         # Playwright end-to-end tests (mocked LLM)
npm run lint             # ESLint
npm run check:portability # guard against non-portable Next.js features
npm run db:generate      # generate Drizzle migrations
npm run db:migrate       # apply migrations to DATABASE_URL
```

## Tests

```bash
npx playwright install chromium   # one-time browser download for E2E
npm test                          # unit + component tests (Vitest)
npm run test:e2e                  # Playwright end-to-end (mocked LLM)
```

The E2E suite runs the real Next.js server and a real SQLite database against a
deterministic stand-in for the LLM (`MOCKABLE_LLM=mock`), so it needs no network access
and no API key. That env flag is test-only; normal runs use the real BYOK provider
registry.

## Environment

Copy `example.env` to `.env`. The app needs `DATABASE_URL` (SQLite file). No LLM key is
configured server-side by design: every user supplies their own key in the Settings UI.

If `DATABASE_URL` is missing the server fails fast with a clear message telling you to
copy `example.env` to `.env`.

## Deploy

The app is a plain Next.js Node server plus one SQLite file, so any Node host with a
**persistent disk** works (VPS, Railway, Fly, Docker).

```bash
git clone <this repo> && cd mockable
cp example.env .env    # edit DATABASE_URL / NEXT_PUBLIC_APP_URL for your host
npm install
npm run db:migrate
npm run build
npm start
```

Point the persistent volume at the directory containing the SQLite file (back it up by
copying the file). Migrations also run automatically the first time the database is
opened, but running `db:migrate` explicitly is recommended before `next start`.

Portability note: the app deliberately avoids server actions, edge middleware,
`next/image`, and Vercel-specific products, so it can move to another Node host or a
Vite + Hono split without a rewrite.
