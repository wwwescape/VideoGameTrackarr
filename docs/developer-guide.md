# Developer guide

Orientation for working in this codebase — conventions and where things live. Start here if
you want to add something and need to know "where"; see [diagrams.md](diagrams.md) for the
system shape at a glance.

## Layout

```
frontend/     frontend (TypeScript, Vite, MUI, TanStack Query, React Router) — own package.json
backend/      FastAPI backend (SQLite by default) — own requirements.txt
e2e/          Playwright end-to-end suite (manual pre-release check, see e2e/README.md)
docs/         this guide, diagrams, deployment examples
```

The root `package.json` only orchestrates: it declares `frontend` as an npm workspace and
holds the e2e-only dependencies (`@playwright/test`, etc.) — actual frontend dependencies
live in `frontend/package.json`.

## Backend conventions

**Layering**: `routes/` → `services/` → `repositories/`. Routes handle HTTP concerns and
call exactly one service method. Services own business logic and the transaction boundary —
they're the only place that calls `db.commit()`. Repositories only `add`/`flush`/`delete`;
they never commit, so a multi-step use case (e.g. importing a game plus its addons) commits
once, atomically, from the service layer.

**API schemas are camelCase** (`CamelModel` in `app/schemas/base.py`, via Pydantic's
`alias_generator`) — the database and Python code stay snake_case; only the JSON contract at
the boundary is camelCase, to match the frontend without either side compromising its own
convention. The one deliberate exception is `app/schemas/backup.py`, which uses plain
snake_case `BaseModel` — it's a machine-only file format (the JSON backup/restore), not an
API response, so there's no frontend convention to match.

**Computed fields, not denormalized columns**: things like a game's `owned`/`wishlisted`
status or its `playStatus`/`rating` are computed fresh on every query via `EXISTS`/
correlated-scalar-subqueries (see `GameWithStatus` in `app/repositories/game_repository.py`),
never stored counters that could drift out of sync. If you're adding a field that's
"derived from other tables," follow this pattern rather than adding a column you'd have to
keep updated everywhere that table changes.

**Adding an endpoint**: schema (`app/schemas/`) → repository function(s) → service function
→ route → register the router in `app/main.py` → tests. Look at a recent, similar feature
(e.g. `app/api/routes/dashboard.py` end-to-end) before starting — the pattern is consistent
enough that copying its shape and adjusting is usually faster than working from scratch.

**Migrations**: `alembic revision --autogenerate -m "describe the change"` after editing a
model in `app/models/`, then read the generated migration before trusting it — autogenerate
gets simple column changes right but not everything (enum/constraint changes in particular
are worth double-checking by hand). Test the round-trip (`upgrade` → `downgrade` → `upgrade`)
against a scratch copy of the real database before trusting a migration that touches
existing data.

## Frontend conventions

**One hook per resource** (`frontend/hooks/`), wrapping TanStack Query — components don't
call `frontend/api/*` functions directly. **One typed API function per backend endpoint**
(`frontend/api/`) — no inline `axios.*` calls in components.

**Destructive actions get undo, not a confirm dialog** — see `useUndoableAction` (a generic
deferred-commit-with-undo hook) and `showUndoToast`. This is the established pattern for
anything destructive (bulk delete, etc.); reach for it before adding a `window.confirm` or a
new modal.

**Large lists are virtualized** — `VirtualGameGrid` (windowed via
`@tanstack/react-virtual`'s `useWindowVirtualizer`) is reused everywhere a grid of
`GameCard`s appears. Don't render an unbounded list of cards directly.

**Offline-aware by default**: mutations already pause/resume automatically when offline
(TanStack Query's `networkMode: 'online'` default) — you don't need to handle offline state
yourself unless a mutation genuinely can't be queued (e.g. it takes a `File`, which can't
survive the offline persister's JSON serialization — see `useRestoreBackup` for the
`networkMode: 'always'` opt-out pattern in that case).

## Testing

```
cd backend && pytest          # backend — coverage reporting + a 90% floor are on by default
npm run test                  # frontend unit/component tests (Vitest + React Testing Library)
npm run test:e2e              # real-browser Playwright suite — see e2e/README.md for setup
```

Backend: a test alongside every feature is the established practice here, not coverage
chased after the fact — current coverage is ~98%. When you find a real bug while building
something (not a hypothetical one), write the regression test with a comment explaining the
mechanism, not just what it checks.

Frontend: Vitest covers hooks/components with real logic worth protecting (not blanket
coverage of every file — see `frontend/hooks/__tests__/`, `frontend/components/__tests__/`
for the current set and what made each one worth writing). The Playwright suite in `e2e/` is
for the class of bug neither unit-test layer can catch: something that only breaks when the
real frontend talks to the real backend over a real connection in a real browser.
