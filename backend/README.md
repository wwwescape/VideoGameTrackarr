# backend/

FastAPI backend (SQLite by default; Postgres-compatible via `DATABASE_URL` if you want it —
see "Database" below). Layered `routes/` → `services/` → `repositories/` — see
`../docs/developer-guide.md` for the conventions.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
```

## Database

Defaults to a local SQLite file at `backend/db/videogametrackarr.db` if `DATABASE_URL` isn't
set. For Postgres, set `DATABASE_URL` (e.g. in the repo-root `.env`) to something like
`postgresql+psycopg://user:password@localhost:5432/videogametrackarr`.

Apply migrations:

```
alembic upgrade head
```

Create a new migration after changing a model in `app/models/`:

```
alembic revision --autogenerate -m "describe the change"
```

Always read the generated migration before trusting it, and test the upgrade/downgrade
round-trip against a scratch copy of a real database before running it against one that
matters.

## Running the API

```
uvicorn app.main:app --reload --port 8000
```

Then visit `http://localhost:8000/healthz` (reports app + database status) or
`http://localhost:8000/docs` (auto-generated OpenAPI docs, with every route below).

Settings (`app/core/config.py`) are pydantic-settings based and read from the repo-root
`.env`; see `Settings` for the full list (database URL, log level, JWT/IGDB/Redis/CORS
config, etc).

CORS defaults to allowing `http://localhost:3000` (the Vite dev server) — an explicit
allow-list. Add more origins via `CORS_ORIGINS` (JSON array) in `.env` if you ever serve the
frontend and backend from different origins in production, though the normal deployment
shape is same-origin (see the root README's "Deploy with Docker").

## Auth

There's no public registration endpoint by design — this is a single-admin-account
instance, so the only way to create or reset the login is the CLI:

```
python -m scripts.create_admin --username admin
```

`JWT_SECRET_KEY` must be set in the repo-root `.env` before logging in — auth calls fail with
a clear `RuntimeError` (not a vague 500) if it's missing, rather than falling back to an
insecure built-in default.

- `POST /api/auth/login` — `{username, password}` → `{accessToken, refreshToken}`. Rate
  limited to 5/minute per IP (brute-force mitigation).
- `POST /api/auth/refresh` — `{refreshToken}` → a new `{accessToken, refreshToken}` pair.
  Refresh tokens rotate on every use and are revoked server-side the moment they're used, so
  a leaked-and-replayed token is rejected on its second use.
- `POST /api/auth/logout` — `{refreshToken}` → revokes it early. Idempotent.
- `GET /api/auth/me` — requires `Authorization: Bearer <accessToken>`.

Access tokens are short-lived (15 min default) and stateless; only refresh tokens hit the
database, since they're the ones long-lived enough to be worth revoking.

## IGDB client

`app/services/igdb_client.py`:

- In-memory access-token caching (refetches ~60s before expiry, not on every call).
- Retry with exponential backoff on transport errors/5xx via `tenacity` (gives up after 3
  attempts; 4xx errors are never retried since they won't change on retry).
- Batched, per-id cached cover lookups — one `/covers` request for everything not already
  cached, instead of one request per game.
- Apicalypse string escaping on search queries — unescaped interpolation would be a
  query-injection vector against IGDB's query language.
- Response caching via `app/services/cache.py`: an in-process TTL cache by default, or
  `RedisCache` automatically if `REDIS_URL` is set.
- Field-expansion via Apicalypse dot-notation pulls genres, companies (with roles),
  franchises, collections, platforms, screenshots, artwork, videos, and release dates in the
  same request as the game itself — no N+1 follow-up calls.

A single `IGDBClient` is created at app startup (`app/main.py`'s `lifespan`) and reused
across requests via `app/api/deps.py:get_igdb_client` — one shared httpx connection pool, not
a fresh client per request.

## Domain routes

Every route below requires `Authorization: Bearer <accessToken>` unless noted. Full request/
response shapes are in the interactive docs (`/docs`) — this is an index, not the spec.

**Games & catalog**
- `GET /api/games?search=` — top-level (non-addon) games, optional substring search.
- `GET /api/games/{id}` — full detail: genres, companies, franchises, collections,
  platforms, screenshots, artwork, videos, release dates, owned/wishlisted status, progress.
- `GET /api/games/{id}/addons` — its DLC/expansion/pack children.
- `POST /api/games` — `{igdbId}` → imports (or re-imports) a game plus its addons from IGDB.
- `POST /api/games/manual` — add a game without IGDB (name/category/release date/cover/summary).
- `POST /api/games/{id}/resync` — re-fetches an already-imported game (and its addons) from IGDB.
- `DELETE /api/games/{id}` — deletes the game, its addons, and everything that references
  them (library items, progress, notes, tags, play sessions, catalog-richness rows) in one
  transaction.
- `GET /api/igdb/search?query=` — search IGDB's catalog (not your library) to find something
  to import.
- `GET /api/franchises/{id}`, `GET /api/collections/{id}` — the games you've already
  imported belonging to that series.
- `GET /api/platforms`, `GET /api/regions` — reference data.

**Library & progress**
- `GET /api/games/{id}/library`, `POST /api/games/{id}/library` — list/add ownership or
  wishlist entries for a game (platform, region, format, edition, storefront, acquired date).
- `PUT /api/library/{id}` — partial update; also how you move an item between owned and
  wishlist (`{status: "owned"}`).
- `DELETE /api/library/{id}` — remove one item.
- `GET /api/games/{id}/progress`, `PUT /api/games/{id}/progress` — play status, playtime,
  rating (0–10), review, started/completed/last-played dates. Every game has a progress
  record conceptually (just unset until touched), so `GET` never 404s for that reason.
- `GET/POST/PUT/DELETE /api/games/{id}/play-sessions`, `/api/play-sessions/{id}` — individual
  logged sessions.
- `GET/POST/PUT/DELETE /api/games/{id}/notes`, `/api/notes/{id}` — free-form notes.
- `GET/POST/DELETE /api/tags`, `/api/games/{id}/tags/{tagId}` — tags, get-or-create by name.

**Insights & dashboard**
- `GET /api/insights/duplicate-library-items` — possible duplicate entries in your library.
- `GET /api/insights/missing-dlc` — addons you own the parent game for but don't own.
- `GET /api/insights/accessories-without-owned-hardware` — owned accessories not linked to any
  hardware you own.
- `GET /api/dashboard/stats` — counts, playtime, breakdowns by status/platform/genre,
  recently added/played.
- `GET /api/dashboard/release-calendar` — your wishlisted/owned games with a future release date.

**Data portability**
- `GET /api/export/csv` — your library as a flat CSV.
- `GET /api/export/backup`, `POST /api/import/backup` — full JSON backup/restore. Restore is
  a full replace (not a merge) and writes an automatic safety snapshot
  (`backend/db/backups/`) before wiping anything. Catalog-richness data (genres, companies,
  etc.) is deliberately excluded from the backup format — it's a re-fetchable IGDB cache,
  not authoritative user data; only the library itself and everything you typed is backed up.

**API shape**: responses use camelCase (`CamelModel`) and computed-not-stored fields for
anything derived from another table (`owned`/`wishlisted`/`playStatus`/`rating` on a game are
all live `EXISTS`/correlated-subquery results, never a counter that could drift out of sync).

## Serving the built frontend

`app/main.py` mounts the frontend's build output (`../build`, a sibling of `backend/`) under
the same FastAPI process — a static file mount for `/assets/*`, and a catch-all route that
falls back to `index.html` for any other path so client-side routes (e.g. `/dashboard`) work
on a direct visit or refresh. Guarded by the directory's existence, so a backend-only dev run
(frontend served separately by Vite, or the test suite — neither ever produces a `build/`
directory) is unaffected.

## Lint

```
ruff check .
```

`alembic/versions/` is excluded — those files are autogenerated and shouldn't be hand-edited
for style.

## Tests

```
pytest
```

Coverage reporting and a 90% floor are on by default (`pyproject.toml`).

## Docker

The Dockerfile lives at the repo root, not here — it's a multi-stage build that builds the
frontend too and serves it from this backend (same origin), so the build context is the
whole repo. See the root README's "Deploy with Docker".
