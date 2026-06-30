#!/bin/sh
set -e

alembic upgrade head

exec "$@"
