"""Each list endpoint runs the same number of queries however big the library is. A count that
grows with the library means a query per row (an N+1), which is what makes a list slow on a
Raspberry Pi. The library is seeded, measured, grown, and measured again."""

import pytest

from tests.perf_helpers import count_queries, seed_library

FLAT_ENDPOINTS = [
    "/api/games",
    "/api/games?sort=release_date_desc",
    "/api/collections",
    "/api/franchises",
    "/api/companies",
    "/api/platforms",
    "/api/platforms/library",
    "/api/regions",
    "/api/tags",
    "/api/tags/coverage",
    "/api/events",
    "/api/events/showcase-0",
    "/api/collections/series-0",
    "/api/franchises/franchise-0",
    "/api/dashboard/stats",
    "/api/dashboard/release-calendar",
    "/api/insights/duplicate-library-items",
    "/api/insights/missing-addons",
    "/api/insights/accessories-without-owned-hardware",
    "/api/insights/on-sale",
    "/api/sales-tracking/tracked",
    "/api/sales-tracking/ignored",
    "/api/igdb-import/entries",
    "/api/public/{token}/games",
    # These five loaded each row's manufacturer, platform, type, colour, storage and
    # reference entry one at a time until 2026-11-01.
    "/api/devices",
    "/api/accessories",
    "/api/hardware-stats",
    "/api/public/{token}/devices",
    "/api/public/{token}/accessories",
]


def _query_counts(auth_client, db_session, path: str) -> tuple[int, int]:
    token = auth_client.post("/api/share-link").json()["token"]
    path = path.format(token=token)
    engine = db_session.get_bind()

    seed_library(db_session, 2)
    db_session.expire_all()
    with count_queries(engine) as small:
        first = auth_client.get(path)
    seed_library(db_session, 4, first=2)
    db_session.expire_all()
    with count_queries(engine) as large:
        second = auth_client.get(path)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    return len(small), len(large)


@pytest.mark.parametrize("path", FLAT_ENDPOINTS)
def test_query_count_does_not_grow_with_the_library(auth_client, db_session, path):
    small, large = _query_counts(auth_client, db_session, path)
    assert large == small, f"{path}: {small} queries for 2 rows, {large} for 6"
