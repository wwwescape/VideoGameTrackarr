# frontend/

TypeScript, Vite, MUI (Material 3 styling), TanStack Query, React Router v6 (data router),
React Hook Form + Zod. A PWA — installable, works offline for previously-viewed data (see
"Offline" below). Talks to `../backend` (FastAPI) — see that project's README for the API.

## Running

```
npm install
npm start          # Vite dev server on :3000
```

Needs the backend running too — `cd ../backend && uvicorn app.main:app --reload --port 8000`.
There's no anonymous access; create an admin account first (`backend/README.md`'s "Auth"
section) and log in at `/login`.

## Testing

```
npm test               # Vitest + React Testing Library
npm run test:coverage  # same, with a coverage report
```

Not blanket coverage of every file — see `hooks/__tests__/` and `components/__tests__/` for
what's covered and why each one was worth writing (timer-based logic reused everywhere,
components with real conditional rendering, that kind of thing). The real-browser Playwright
suite covering full user journeys lives in `../e2e` — see its README.

## Layout

- `api/` — typed fetch functions per resource (`games.ts`, `library.ts`, `auth.ts`, ...), plus
  `client.ts` (the shared axios instance: attaches the access token, and on a 401
  transparently refreshes and retries once before giving up and redirecting to `/login`)
  and `types.ts` (response/request shapes matching the backend's Pydantic schemas —
  hand-written, not codegen'd from the OpenAPI spec).
- `hooks/` — TanStack Query hooks wrapping `api/*`, one file per resource. Components call
  these, never `api/*` directly.
- `components/` — page-level and shared components.
- `pages/` — currently just `Login.tsx`; most routed pages live in `components/` instead —
  not a deliberate convention, just how it's grown. Feel free to move things into `pages/`
  as you touch them.
- `routes/ProtectedLayout.tsx` — the auth guard. Presence-checks the access token; doesn't
  validate it (that's `api/client.ts`'s job on the first real request) to avoid a network
  round-trip before rendering.
- `router.tsx` — the `createBrowserRouter` tree.
- `theme/` — the Material 3 color/typography/shape system (`m3Colors.ts` generates a full
  M3 scheme from one seed color via `@material/material-color-utilities`).
- `offline/` — TanStack Query cache persistence (IndexedDB via `idb-keyval`) for offline
  browsing — see "Offline" below.
- `navigation/` — the three responsive nav patterns (bottom bar, rail, drawer), all reading
  from one shared destination list (`destinations.tsx`) so they can't drift apart.
- `test/setup.ts` — Vitest setup (jest-dom matchers, React Testing Library cleanup).

## Auth

Tokens live in `localStorage` (`api/tokenStorage.ts`), not an httpOnly cookie — matches the
backend returning tokens in the JSON response body rather than setting cookies. Reasonable
for a self-hosted single-admin app; revisit if this ever becomes multi-tenant or the threat
model changes. Refresh tokens rotate on every use; the response interceptor in `api/client.ts`
queues concurrent requests during a refresh so they don't each trigger their own.

## Offline

This is a PWA: installable, with a service worker (Workbox, via `vite-plugin-pwa`) caching
the app shell and IGDB cover art. Separately, the entire TanStack Query cache persists to
IndexedDB, so previously-viewed games/lists/dashboards are browsable offline from a cold
start, not just within the same tab session.

Mutations made while offline queue automatically and flush on reconnect (TanStack Query's
default `networkMode: 'online'` behavior) — `components/OfflineStatusIndicator.tsx` surfaces
this with a toast on the offline transition and a live pending-change count, since
`mutateAsync()` alone gives no feedback while a mutation is paused. Two mutations
(`useImportCsv`, `useRestoreBackup`) opt out via `networkMode: 'always'` since they take a
`File`, which can't survive the offline persister's JSON serialization.

## Destructive actions

Bulk delete (and anything else destructive) uses `useUndoableAction` — a deferred-commit
hook paired with an undo toast — instead of a confirm dialog. The action is staged
immediately (so the UI can hide/disable the affected items right away) and only actually
commits after a delay unless undone first.
