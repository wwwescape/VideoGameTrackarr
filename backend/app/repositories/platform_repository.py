from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import GamePlatform, Platform


def list_platforms(db: Session) -> list[Platform]:
    return list(db.scalars(select(Platform).order_by(Platform.name)))


def get_by_name(db: Session, name: str) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Platform:
    # CSV import names platforms/regions as free text (matching what a personal
    # spreadsheet would have) — get-or-create by name, same lenient pattern as tags.
    platform = get_by_name(db, name)
    if platform is not None:
        return platform

    platform = Platform(name=name)
    db.add(platform)
    db.flush()
    return platform


def get_by_igdb_id(db: Session, igdb_id: int) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None, abbreviation: str | None) -> Platform:
    platform = db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()
    if platform is not None:
        return platform

    # IGDB occasionally disambiguates a platform's slug with a trailing "--N" suffix (e.g.
    # "ps4--1") when its own catalog has more than one row for what's conceptually the same
    # hardware. A row from before this app tracked igdb_id (igdb_id is NULL) may already
    # represent that same platform under the bare slug — match on it and backfill the link
    # instead of inserting a parallel duplicate. Name/slug/abbreviation are deliberately
    # left untouched here and above: once a platform row exists, its display name may have
    # been deliberately curated (e.g. "Sony PlayStation 4") and shouldn't be silently
    # overwritten by IGDB's raw name on a later sync.
    bare_slug = slug.split("--")[0] if slug else None
    if bare_slug:
        platform = db.scalars(select(Platform).where(Platform.slug == bare_slug)).first()
        if platform is not None:
            platform.igdb_id = igdb_id
            db.flush()
            return platform

    platform = Platform(igdb_id=igdb_id, name=name, slug=slug, abbreviation=abbreviation)
    db.add(platform)
    db.flush()
    return platform


def sync_for_game(db: Session, game_id: int, platform_ids: list[int]) -> None:
    db.execute(delete(GamePlatform).where(GamePlatform.game_id == game_id))
    for platform_id in platform_ids:
        db.add(GamePlatform(game_id=game_id, platform_id=platform_id))
    db.flush()
