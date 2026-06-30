# Architecture diagrams

Companion to [developer-guide.md](developer-guide.md). These two diagrams capture the
system's shape — components and the auth flow, the two things that are hardest to hold in
your head from reading code alone. Both render natively on GitHub (Mermaid).

## System components

```mermaid
flowchart TB
    subgraph Browser
        SW["Service worker<br/>(Workbox — app shell + IGDB cover-art cache)"]
        RQ["TanStack Query cache<br/>(persisted to IndexedDB — offline browsing)"]
        UI["React app (frontend/)<br/>MUI, React Router, React Hook Form"]
        UI <--> RQ
        UI <-.->|registers, intercepts fetches| SW
    end

    UI -->|HTTPS, same origin in prod| API

    subgraph Server["Docker container"]
        API["FastAPI (backend/)<br/>routes -> services -> repositories"]
        DB[("SQLite<br/>backend/db/*.db<br/>named volume")]
        Cache[("Cache backend<br/>in-process, or Redis if REDIS_URL set")]
        API --> DB
        API --> Cache
    end

    API -->|Apicalypse queries, cached responses| IGDB[("IGDB API<br/>(external)")]
    SW -.->|CacheFirst, 30-day expiry| IGDB

    classDef ext fill:#f5f5f5,stroke:#999;
    class IGDB ext;
```

A few things this makes explicit that aren't obvious from the directory layout alone:

- **One origin, not two.** The frontend and backend are drawn as one deployable unit (the
  Docker container described in the root README) — FastAPI serves the built frontend
  itself, not a separate Nginx/static host. `frontend/api/client.ts`'s `API_BASE_URL` logic
  only branches for local dev, where Vite (`:3000`) and FastAPI (`:8000`) really are
  separate origins.
- **Two independent caching layers**, deliberately not unified: TanStack Query persists
  *parsed application data* (so the game list/details/dashboard are browsable offline from
  a cold start); the service worker separately caches *IGDB's cover images* (raw bytes,
  which the data-layer cache was never going to hold). Conflating them would mean one cache
  doing a job it's not shaped for.
- **The cache backend is a `Protocol`, not a hard Redis dependency** (`app/services/cache.py`)
  — a single self-hosted instance gets an in-process TTL cache for free; Redis is additive,
  not required (see the docker-compose `redis` profile).

## Auth flow (login, then a token refresh)

```mermaid
sequenceDiagram
    participant U as Browser
    participant A as apiClient (axios)
    participant S as FastAPI

    U->>S: POST /api/auth/login (username, password)
    S-->>U: 200 { accessToken, refreshToken }
    Note over U: tokenStorage (localStorage)

    U->>A: any API call
    A->>S: request + Authorization: Bearer accessToken
    S-->>A: 200 (while accessToken is valid)

    Note over A,S: accessToken expires (15 min)
    U->>A: any API call
    A->>S: request + expired accessToken
    S-->>A: 401
    A->>S: POST /api/auth/refresh (refreshToken)
    alt refresh token still valid
        S-->>A: 200 { new accessToken, new refreshToken }
        Note over S: old refresh token revoked - rotation means a stolen one is replayable once, at most
        A->>S: retries original request with new accessToken
        S-->>A: 200
    else refresh token invalid/already used/revoked
        S-->>A: 401
        A->>U: window.location.assign("/login")
    end
```

The retry-once-then-redirect logic and the concurrent-request queueing while a refresh is
in flight both live in `frontend/api/client.ts`'s response interceptor — worth reading
alongside this diagram if you're touching auth, since the sequence above is the *intended*
behavior the interceptor's queueing exists to preserve correctly under concurrency.
