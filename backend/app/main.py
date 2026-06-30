from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import (
    accessories,
    auth,
    collections,
    companies,
    dashboard,
    device,
    franchises,
    games,
    hardware_lookups,
    hardware_stats,
    health,
    igdb,
    import_export,
    insights,
    library,
    notes,
    platforms,
    progress,
    regions,
    tags,
    uploads,
)
from app.core.config import REPO_ROOT, UPLOADS_DIR, get_settings
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import IGDBClient, IGDBCredentialsError

FRONTEND_BUILD_DIR = REPO_ROOT / "build"


def resolve_static_file(base_dir: Path, requested_path: str) -> Path | None:
    """Returns the real file under base_dir to serve for requested_path, or None if it
    should fall back to index.html (SPA client-side route, or nothing matched). Pulled out
    of the route handler so the path-traversal guard is unit-testable on its own, without
    depending on whether a real frontend build happens to exist on disk.

    requested_path is attacker-controlled - resolving and confirming the result is still
    inside base_dir (rather than trusting the joined path directly) is what stops a request
    like "../../etc/passwd" from escaping base_dir to serve arbitrary filesystem contents.
    """
    if not requested_path:
        return None
    candidate = (base_dir / requested_path).resolve()
    if candidate.is_relative_to(base_dir) and candidate.is_file():
        return candidate
    return None


configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.igdb_client = IGDBClient()
    yield
    await app.state.igdb_client.aclose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(IGDBCredentialsError)
async def igdb_credentials_handler(request: Request, exc: IGDBCredentialsError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(platforms.router)
app.include_router(regions.router)
app.include_router(games.router)
app.include_router(igdb.router)
app.include_router(library.router)
app.include_router(progress.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(import_export.router)
app.include_router(insights.router)
app.include_router(franchises.router)
app.include_router(collections.router)
app.include_router(dashboard.router)
app.include_router(hardware_lookups.router)
app.include_router(device.router)
app.include_router(accessories.router)
app.include_router(hardware_stats.router)
app.include_router(companies.router)
app.include_router(uploads.router)

# Uploaded cover images (see app/services/upload_service.py) — created on first use rather
# than committed to the repo, so it needs to exist before StaticFiles will mount it.
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Serves the built frontend (npm run build's output) from the same origin as the API.
# Guarded by existence so a backend-only dev run (frontend served separately by Vite on
# :3000, or the test suite, neither of which ever produce a build/ directory) is
# unaffected. Registered last so it never shadows the /api/* or /healthz routes above —
# Starlette matches routes in registration order.
if FRONTEND_BUILD_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        static_file = resolve_static_file(FRONTEND_BUILD_DIR, full_path)
        return FileResponse(static_file if static_file is not None else FRONTEND_BUILD_DIR / "index.html")
