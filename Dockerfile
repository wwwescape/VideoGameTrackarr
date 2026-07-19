# Multi-stage build: stage 1 builds the frontend (Vite), stage 2 runs the FastAPI backend
# and serves that build from the same origin (see backend/app/main.py's serve_frontend()).
# The container's /app mirrors the repo's own backend/ + build/ sibling layout, since
# backend/app/core/config.py derives REPO_ROOT (and therefore where it looks for build/)
# relative to backend/'s own location — see FRONTEND_BUILD_DIR in backend/app/main.py.

FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM python:3.12-slim
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /app/build /app/build

# Default DATABASE_URL (sqlite, see app/core/config.py) needs this directory to exist;
# it's also where the named volume in docker-compose.yml mounts, for persistence. uploads/
# (UPLOADS_DIR, app/services/upload_service.py) is the same story for uploaded cover images.
RUN mkdir -p db uploads \
    && chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app

# Stays root here — chown of db/uploads doesn't reliably survive a QEMU-emulated
# cross-arch build (see .github/workflows/release.yml's linux/arm64 build), so
# docker-entrypoint.sh re-chowns those two dirs at container start instead, then drops to
# appuser itself before exec'ing the app.

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz', timeout=3).status == 200 else 1)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
