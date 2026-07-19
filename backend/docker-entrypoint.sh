#!/bin/sh
set -e

# Fix ownership at runtime, not build time — see Dockerfile for why (chown under QEMU
# cross-arch emulation doesn't reliably persist into the image). Cheap and idempotent, and
# it also covers a freshly-created named volume, which always copies in with the image's
# on-disk ownership at the time this ran, not whatever chown baked into the layer.
chown -R appuser:appuser db uploads

su -s /bin/sh appuser -c "alembic upgrade head"
exec su -s /bin/sh appuser -c "exec $*"
