import logging
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
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES, GZipMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.routes import (
    accessories,
    auth,
    catalog_resync,
    collections,
    companies,
    danger_zone,
    dashboard,
    device,
    events,
    franchises,
    game_cases,
    games,
    genres,
    hardware_lookups,
    hardware_stats,
    health,
    igdb,
    igdb_import,
    import_export,
    insights,
    integrations,
    jobs,
    labs,
    library,
    notes,
    platforms,
    progress,
    public,
    regions,
    roms,
    sales_tracking,
    share,
    tags,
    toys_to_life,
    uploads,
    version,
)
from app.core.config import (
    HARDWARE_REFERENCE_IMAGES_DIR,
    REPO_ROOT,
    TOYS_TO_LIFE_IMAGES_DIR,
    UPLOADS_DIR,
    get_settings,
)
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.core.security import weak_secret_warning
from app.db.session import SessionLocal
from app.services import auth_service, job_definitions, job_scheduler, platprices_service, rom_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import IGDBClient, IGDBCredentialsError

FRONTEND_BUILD_DIR = REPO_ROOT / "build"


class UploadsStaticFiles(StaticFiles):
    """The public /uploads mount, minus the roms/ subfolder. Covers and accessory images are
    fine to serve unauthenticated (they're shown on public share pages too), but uploaded
    ROMs live under the same directory (see rom_service.get_rom_dir) and must only ever be
    reachable through the signed-URL route in app/api/routes/roms.py."""

    def get_path(self, scope: Scope) -> str:
        path = super().get_path(scope)
        first_segment = path.replace("\\", "/").lstrip("/").split("/", 1)[0]
        if first_segment.lower() == rom_service.ROMS_SUBDIR:
            raise StarletteHTTPException(status_code=404)
        return path


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


# The DOS/PSP player tab needs SharedArrayBuffer (threaded emulator cores), which browsers
# only allow on a cross-origin-isolated page. Only that page and the player iframe it loads
# get these headers — the main app loads cross-origin images (IGDB cover art) that
# require-corp would block.
CROSS_ORIGIN_ISOLATION_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
}


# Sent on every response (as in DieCastCollectionTracker). The app's CSP fits the built
# frontend: scripts and styles from this origin only (MUI injects <style> tags, hence
# 'unsafe-inline' for styles; no script is inline), images also from https: (IGDB covers,
# YouTube and Steam artwork), YouTube's no-cookie player and this app's own emulator page as
# the only frames, and the service worker may fetch IGDB images to cache them. No other site
# may frame the app.
APP_CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://images.igdb.com",
        "frame-src 'self' https://www.youtube-nocookie.com",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
    ]
)
# The self-hosted EmulatorJS player (frontend/public/emulatorjs/) compiles WebAssembly and
# loads its cores and workers from blob: URLs, which the app's policy rightly refuses; it
# still only loads from this origin and can only be framed by the app itself.
EMULATOR_CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: data:",
        "font-src 'self' data:",
        "connect-src 'self' blob: data:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
    ]
)
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    # The app frames its own emulator page, so SAMEORIGIN rather than DENY.
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}
# Unlisted share links carry their token in the path; don't hand it to the sites the
# shared pages link to.
PUBLIC_REFERRER_POLICY = "no-referrer"


def security_headers_for(path: str) -> dict[str, str]:
    headers = dict(SECURITY_HEADERS)
    headers["Content-Security-Policy"] = (
        EMULATOR_CONTENT_SECURITY_POLICY if path.startswith("/emulatorjs/") else APP_CONTENT_SECURITY_POLICY
    )
    if path.startswith("/public/") or path.startswith("/api/public/"):
        headers["Referrer-Policy"] = PUBLIC_REFERRER_POLICY
    return headers


# How long browsers (and Cloudflare, in front of a tunnel) may keep a response. Built assets
# have content-hashed names, and uploaded covers and accessory photos get a new UUID name on
# every upload (upload_service.py; a restore writes the same bytes back under the same name),
# so they never change and can be kept for a year. Everything else that isn't the API —
# index.html, the service worker, the manifest, the emulator's unhashed files, the hardware
# reference photos (named after the product, so a release can replace one) — is checked on
# every load, so a new release shows up straight away. The API sets its own (the ROM and BIOS
# routes send private, no-store). Errors never get one; a 304 repeats what the 200 would have
# said, as HTTP expects of a revalidation.
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
CACHED_FOREVER_PREFIXES = ("/assets/", "/uploads/covers/", "/uploads/accessory-images/", "/uploads/game-media/")


def cache_control_for(path: str) -> str | None:
    if path.startswith(CACHED_FOREVER_PREFIXES):
        return IMMUTABLE_CACHE
    if path.startswith("/api/") or path == "/healthz":
        return None
    return "no-cache"


# Compresses JSON, JS, CSS and HTML for everyone who reaches the app directly (LAN,
# Tailscale); Cloudflare already compresses for visitors through a tunnel. Level 5, not
# Starlette's 9: nearly as small, at a fraction of the CPU on a Raspberry Pi. Starlette skips
# range (206) responses and images and zips by type; the emulator's multi-MB cores, ROMs,
# BIOS files, save states and full backups are passed through by path as well, since they
# are already compressed or binary and gzipping them per request would cost the Pi far more
# than it saves (and drop the Content-Length the emulator's download progress uses).
UNCOMPRESSED_PATH_PREFIXES = ("/emulatorjs/", "/api/roms/", "/api/emulation/bios/", "/api/export/backup/full/")
UNCOMPRESSED_CONTENT_TYPES = (
    *DEFAULT_EXCLUDED_CONTENT_TYPES,
    "application/octet-stream",
    "application/wasm",
    "application/x-7z-compressed",
)


class SelectiveGZipMiddleware(GZipMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app, minimum_size=1024, compresslevel=5, exclude_content_types=UNCOMPRESSED_CONTENT_TYPES)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].startswith(UNCOMPRESSED_PATH_PREFIXES):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


def isolation_headers_for(requested_path: str, threads: str | None) -> dict[str, str]:
    if requested_path == "player-isolated.html" or (requested_path == "emulatorjs/player.html" and threads == "1"):
        return dict(CROSS_ORIGIN_ISOLATION_HEADERS)
    return {}


configure_logging()
settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.igdb_client = IGDBClient()

    job_definitions.register_builtin_jobs()
    db = SessionLocal()
    try:
        auth_service.announce_setup_code(db)
        if warning := weak_secret_warning():
            logger.warning(warning)
        job_scheduler.start(db, SessionLocal)
        try:
            cleared = platprices_service.clear_prices_from_other_regions(db)
            if cleared:
                logger.info("Cleared %d cached PlatPrices price(s) from a previous region", cleared)
        except Exception:  # noqa: BLE001 - a stale-price cleanup must never stop startup
            db.rollback()
            logger.exception("Couldn't clear PlatPrices prices from a previous region")
    finally:
        db.close()

    yield

    job_scheduler.shutdown()
    await app.state.igdb_client.aclose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Added first, so it's the innermost middleware and sees each route's whole response: the
# security-headers middleware below re-streams every body, which would make every response
# look like a stream to gzip (compressing even tiny ones and dropping Content-Length).
app.add_middleware(SelectiveGZipMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in security_headers_for(request.url.path).items():
        response.headers.setdefault(name, value)
    cache_control = cache_control_for(request.url.path)
    if cache_control and response.status_code in (200, 304):
        response.headers.setdefault("Cache-Control", cache_control)
    return response


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
app.include_router(game_cases.router)
app.include_router(igdb.router)
app.include_router(igdb_import.router)
app.include_router(danger_zone.router)
app.include_router(library.router)
app.include_router(progress.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(import_export.router)
app.include_router(import_export.download_router)
app.include_router(insights.router)
app.include_router(franchises.router)
app.include_router(genres.router)
app.include_router(collections.router)
app.include_router(catalog_resync.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(hardware_lookups.router)
app.include_router(device.router)
app.include_router(accessories.router)
app.include_router(toys_to_life.router)
app.include_router(hardware_stats.router)
app.include_router(companies.router)
app.include_router(uploads.router)
app.include_router(jobs.router)
app.include_router(labs.router)
app.include_router(version.router)
app.include_router(share.router)
app.include_router(integrations.router)
app.include_router(sales_tracking.router)
app.include_router(roms.router)
app.include_router(roms.content_router)
app.include_router(public.router)

# Uploaded cover images (see app/services/upload_service.py) — created on first use rather
# than committed to the repo, so it needs to exist before StaticFiles will mount it.
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", UploadsStaticFiles(directory=UPLOADS_DIR), name="uploads")

# Curated HardwareReferenceEntry product shots — checked into the repo (see
# HARDWARE_REFERENCE_IMAGES_DIR), but still created defensively so StaticFiles can mount it
# even before any images have been added.
HARDWARE_REFERENCE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/hardware-reference",
    StaticFiles(directory=HARDWARE_REFERENCE_IMAGES_DIR),
    name="hardware-reference-images",
)

# Curated Toys-to-Life pack photos — same idea as the hardware reference shots above.
TOYS_TO_LIFE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/toys-to-life", StaticFiles(directory=TOYS_TO_LIFE_IMAGES_DIR), name="toys-to-life-images")

# Serves the built frontend (npm run build's output) from the same origin as the API.
# Guarded by existence so a backend-only dev run (frontend served separately by Vite on
# :3000, or the test suite, neither of which ever produce a build/ directory) is
# unaffected. Registered last so it never shadows the /api/* or /healthz routes above —
# Starlette matches routes in registration order.
if FRONTEND_BUILD_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str, request: Request) -> FileResponse:
        static_file = resolve_static_file(FRONTEND_BUILD_DIR, full_path)
        return FileResponse(
            static_file if static_file is not None else FRONTEND_BUILD_DIR / "index.html",
            headers=isolation_headers_for(full_path, request.query_params.get("threads")),
        )
