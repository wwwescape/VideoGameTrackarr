#!/bin/sh
set -e

# Fix ownership at runtime, not build time — see Dockerfile for why (chown under QEMU
# cross-arch emulation doesn't reliably persist into the image). Cheap and idempotent, and
# it also covers a freshly-created named volume, which always copies in with the image's
# on-disk ownership at the time this ran, not whatever chown baked into the layer.
chown -R appuser:appuser db uploads

# Drop to appuser with setpriv rather than su: su stays behind as the app's parent instead
# of exec'ing it, and "exec $*" re-split any argument containing spaces.
setpriv --reuid=appuser --regid=appuser --init-groups alembic upgrade head
exec setpriv --reuid=appuser --regid=appuser --init-groups "$@"
