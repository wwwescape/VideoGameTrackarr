<p align="center">
  <img src="frontend/public/icon-master.svg" alt="VideoGameTrackarr logo" width="120" />
</p>

<h1 align="center">VideoGameTrackarr</h1>

<p align="center">
  A self-hosted web app for tracking your video game collection — what you own, what you want,
  what you're playing, and how it's going — with Steam sync, wishlist sale alerts, and in-browser
  play for the games you own.
</p>

<p align="center">
  <a href="https://github.com/wwwescape/VideoGameTrackarr/releases"><img src="https://img.shields.io/github/v/release/wwwescape/VideoGameTrackarr.svg?style=flat-square" alt="GitHub release" /></a>
  <a href="https://github.com/wwwescape/VideoGameTrackarr/commits/master"><img src="https://img.shields.io/github/last-commit/wwwescape/VideoGameTrackarr.svg?style=flat-square" alt="GitHub last commit" /></a>
  <a href="https://github.com/wwwescape/VideoGameTrackarr"><img src="https://img.shields.io/github/languages/code-size/wwwescape/VideoGameTrackarr.svg?color=red&style=flat-square" alt="GitHub code size" /></a>
</p>

## Screenshots

![](./screenshots/1.png)
![](./screenshots/2.png)
![](./screenshots/3.png)
![](./screenshots/4.png)
![](./screenshots/5.png)

## Features

- **Library tracking** — owned games and a wishlist, per platform, region, and format
  (physical, digital, ISO, ROM, or Abandonware), with edition, storefront, steelbook, notes,
  and purchase or target price.
- **IGDB-powered catalog** — search IGDB, preview a game before adding it, or bulk-add several
  at once. Genres, companies, platforms, media, release dates, store links, collections, series,
  and addons (DLC, expansions, and packs) all come along.
- **Personal tracking** — progress and play sessions per platform you own a game on, a 0–10
  rating with review, notes, and colored tags (with a Tag Manager and bulk tagging).
- **Filters & sort** — filter by platform, format, storefront, tag, ownership, game type,
  steelbook, collection, or series (each with an Exclude option), and sort by name or release
  date. Pages remember your search, filters, and sort.
- **Hardware** — devices and accessories from a curated Sony, Microsoft, Nintendo, and Sega
  catalog, with product photos.
- **Steam sync** — import your Steam library and wishlist with playtime, review every change
  before it's applied, and relink or unlink mismatched entries.
- **Sale tracking** — opt-in wishlist price tracking via IsThereAnyDeal (PC, Mac, Linux, and
  Android) and PlatPrices (PlayStation), with target prices and an **On Sale** page.
- **Events** — upcoming gaming-industry events from IGDB, with any featured games already in
  your library.
- **In-browser play** — upload ROMs for games you own and play over 25 systems right in the
  browser, with a self-hosted emulator and saves kept on your server. See
  [docs/emulation.md](docs/emulation.md).
- **Media viewer** — a lightbox for screenshots and artwork, and a video player for trailers.
- **Dashboard & insights** — collection stats, game and hardware release calendars, duplicate
  detection, missing addons, orphaned accessories, and side-by-side game comparison.
- **Share links** — unlisted, read-only links to your Games or Hardware collection.
- **Jobs** — scheduled catalog resyncs, Steam import, sale refreshes, and event syncs, with live
  progress.
- **Data portability** — CSV export, and JSON or full `.zip` backups (including ROMs, saves,
  and BIOS files) with an automatic safety snapshot before every restore.
- **PWA** — installable, works offline for anything you've already viewed, and syncs offline
  edits when you reconnect.
- **Material 3 design** — light and dark mode, responsive navigation, and virtualized lists for
  large collections.
- **Languages** — English, Spanish, French, and Portuguese.
- **Single admin, self-hosted** — no public registration, no multi-tenancy.

## Installation

The published Docker image bundles the frontend and backend into a single container. Create a
`docker-compose.yml`:

```yaml
services:
  app:
    image: wwwescape/videogametrackarr:latest
    container_name: videogametrackarr
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - db-data:/app/backend/db
      - uploads-data:/app/backend/uploads
    restart: unless-stopped

volumes:
  db-data:
  uploads-data:
```

Create a `.env` file next to it (see [Configuration](#configuration)), then start it:

```bash
docker compose up -d
```

Open `http://localhost:8000`. The first visit shows a create-admin form — fill it in once and
you're signed in. If you ever get locked out,
`docker compose exec app python -m scripts.create_admin --username admin` resets the password.

Migrations run automatically on startup, and your database and uploads live in the named
volumes, so they survive restarts and upgrades. Reverse proxy examples (Nginx, Traefik) are in
[docs/deployment/](docs/deployment/).

### Upgrading

```bash
docker compose pull && docker compose up -d
```

Running from source instead? `git pull`, reinstall dependencies if they changed, then run
`alembic upgrade head` from `backend/` before starting the app. Any breaking change is called
out in that release's notes.

## Configuration

Settings live in `.env` (see [.env.example](.env.example) for every option). Only IGDB and a JWT
secret are required:

```env
IGDB_CLIENT_ID=your_igdb_client_id
IGDB_CLIENT_SECRET=your_igdb_client_secret
JWT_SECRET_KEY=            # generate with: python -c "import secrets; print(secrets.token_hex(32))"
```

Get IGDB credentials at https://api-docs.igdb.com/#getting-started (free, requires a Twitch
developer account).

Optional integrations — add a key and restart. Each shows a live status in **Settings →
Integrations**:

| Integration    | Setting              | Get a key                                                         | Notes                                                                                                                                      |
| -------------- | -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Steam          | `STEAM_API_KEY`      | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) | Your SteamID64 is set in-app, under **Settings → Integrations**.                                                                     |
| IsThereAnyDeal | `ITAD_API_KEY`       | [isthereanydeal.com/apps/my](https://isthereanydeal.com/apps/my/) | PC, Mac, Linux, and Android prices. `ITAD_COUNTRY` sets the store country.                                                                |
| PlatPrices     | `PLATPRICES_API_KEY` | [platprices.com/api-request](https://platprices.com/api-request) | PlayStation prices. The free tier tracks 2 PS Store regions, chosen on your PlatPrices dashboard — `PLATPRICES_REGION` must match one. |

Other options: `ROM_MAX_UPLOAD_MB` (default `2048`) caps ROM uploads — raise your reverse
proxy's upload limit to match. `DATABASE_URL` (SQLite by default), `REDIS_URL`, and
`CORS_ORIGINS` are optional.

## Development

Requires [Git](https://git-scm.com/downloads), [Node.js 22+](https://nodejs.org/en/download/current),
and [Python 3.12+](https://www.python.org/downloads/).

```bash
git clone https://github.com/wwwescape/VideoGameTrackarr.git
cd VideoGameTrackarr
npm install
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
alembic upgrade head
```

Create `.env` in the project root as described in [Configuration](#configuration), then run the
backend and frontend in two terminals:

```bash
cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000
```

```bash
npm start
```

The frontend runs on `http://localhost:3000` and talks to the backend on `http://localhost:8000`.

### Test

```bash
npm run lint && npm run typecheck && npm test && npm run build
cd backend && ruff check . && pytest
```

A Playwright end-to-end suite (`npm run test:e2e`) covers critical user journeys as a manual
pre-release check — see [e2e/README.md](e2e/README.md).

### Release a new version

```bash
git tag v1.26.0
git push origin v1.26.0
```

The tag push publishes the Docker image to GHCR and Docker Hub (tagged with the version and
`latest`) and creates a GitHub Release. Publishing to Docker Hub needs the `DOCKERHUB_USERNAME`
and `DOCKERHUB_TOKEN` repository secrets.

### Project layout

```
frontend/   TypeScript, Vite, MUI, TanStack Query, React Router — own package.json
backend/    FastAPI, SQLAlchemy, Alembic (SQLite by default) — own requirements.txt
e2e/        Playwright end-to-end suite (manual pre-release check)
docs/       Developer guide, diagrams, emulation guide, and deployment examples
```

See [docs/developer-guide.md](docs/developer-guide.md) for conventions, and
[CONTRIBUTING.md](CONTRIBUTING.md) if you're sending a PR.

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Support

If you find VideoGameTrackarr useful, consider buying me a coffee:

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" />](https://buymeacoffee.com/wwwescape)
