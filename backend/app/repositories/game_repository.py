from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, delete, exists, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.catalog import (
    Artwork,
    Game,
    GameCategory,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    ReleaseDate,
    Screenshot,
)
from app.models.library import GameProgress, GameTag, LibraryItem, LibraryStatus, Note, PlaySession, PlayStatus

# Repositories only add/flush/delete — they never commit. The service (or script) that
# calls them owns the transaction boundary, so a multi-step use case (e.g. importing a
# game plus its addons) commits exactly once, atomically.


@dataclass
class GameWithStatus:
    """A Game plus whether it's owned/wishlisted (and its play status/rating, if any),
    computed fresh via EXISTS/correlated-scalar-subquery on every query — never a stored
    counter that could drift out of sync with the library_items it's derived from."""

    game: Game
    owned: bool
    wishlisted: bool
    play_status: PlayStatus | None
    rating: float | None


def _owned_exists(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(LibraryItem.game_id == game_id_column, LibraryItem.status == LibraryStatus.OWNED)


def _wishlisted_exists(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(LibraryItem.game_id == game_id_column, LibraryItem.status == LibraryStatus.WISHLIST)


def _play_status_subquery(game_id_column: ColumnElement[int]) -> ColumnElement[PlayStatus | None]:
    return select(GameProgress.play_status).where(GameProgress.game_id == game_id_column).scalar_subquery()


def _rating_subquery(game_id_column: ColumnElement[int]) -> ColumnElement[float | None]:
    return select(GameProgress.rating).where(GameProgress.game_id == game_id_column).scalar_subquery()


def _row_to_game_with_status(row: Any) -> GameWithStatus:
    return GameWithStatus(game=row[0], owned=bool(row[1]), wishlisted=bool(row[2]), play_status=row[3], rating=row[4])


# What counts as a browsable "game" in the main games list / Dashboard, as opposed to
# something only reachable through a parent's Addons tab (DLC/expansion/pack — kept off this
# list via parent_game_id already) or that's just metadata noise around a real game rather
# than something a user tracks as its own entry — community mods, seasons, updates, ports,
# forks, episodes. Mirrors igdb_client._BROWSABLE_GAME_TYPES (search/import only ever offer
# these same categories to add in the first place). NULL stays included: better to show an
# unclassifiable game than silently hide it because IGDB never returned a category for it.
_BROWSABLE_CATEGORIES = (
    GameCategory.MAIN_GAME,
    GameCategory.BUNDLE,
    GameCategory.STANDALONE_EXPANSION,
    GameCategory.REMAKE,
    GameCategory.REMASTER,
    GameCategory.EXPANDED_GAME,
)


def _is_browsable_game(category_column: ColumnElement[GameCategory | None]) -> ColumnElement[bool]:
    return category_column.in_(_BROWSABLE_CATEGORIES) | category_column.is_(None)


def list_top_level_games(db: Session, search: str | None = None) -> list[GameWithStatus]:
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        _rating_subquery(Game.id),
    ).where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
    if search:
        stmt = stmt.where(Game.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Game.name)
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def _get_game_options() -> tuple[Any, ...]:
    # selectinload (separate SELECT...IN queries), not joinedload, for the one-to-many/
    # many-to-many richness relations — joining all of them in a single query would
    # multiply the one Game row by the cross product of every related row. joinedload is
    # still right for to-one relations, including the ones nested inside a selectinload
    # (parent_game here; genre/company/franchise/collection/platform within each
    # junction row below).
    return (
        joinedload(Game.parent_game),
        joinedload(Game.display_parent_game),
        selectinload(Game.genres).joinedload(GameGenre.genre),
        selectinload(Game.companies).joinedload(GameCompany.company),
        selectinload(Game.franchises).joinedload(GameFranchise.franchise),
        selectinload(Game.collections).joinedload(GameCollection.collection),
        selectinload(Game.platforms).joinedload(GamePlatform.platform),
        selectinload(Game.screenshots),
        selectinload(Game.artworks),
        selectinload(Game.videos),
        selectinload(Game.release_dates).joinedload(ReleaseDate.platform),
    )


def get_game(db: Session, game_id: int) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.id == game_id)
    )
    row = db.execute(stmt).first()
    if row is None:
        return None
    return _row_to_game_with_status(row)


def get_game_by_uuid(db: Session, game_uuid: str) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.uuid == game_uuid)
    )
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_slug(db: Session, slug: str) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.slug == slug)
    )
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_igdb_id(db: Session, igdb_id: int) -> Game | None:
    return db.scalars(select(Game).where(Game.igdb_id == igdb_id)).first()


def list_addons(db: Session, parent_game_id: int) -> list[GameWithStatus]:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(Game.parent_game_id == parent_game_id)
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def create_manual_game(db: Session, **fields: Any) -> Game:
    """A game with no igdb_id — added by hand rather than imported, so there's nothing to
    resync against. See app/services/manual_game_service.py."""
    game = Game(**fields)
    db.add(game)
    db.flush()
    return game


def update_manual_game(db: Session, game: Game, **fields: Any) -> Game:
    for key, value in fields.items():
        setattr(game, key, value)
    db.flush()
    return game


def upsert_game_from_igdb(db: Session, igdb_id: int, **fields: Any) -> Game:
    game = get_game_by_igdb_id(db, igdb_id)
    if game is None:
        game = Game(igdb_id=igdb_id)
        db.add(game)

    for key, value in fields.items():
        setattr(game, key, value)

    db.flush()
    return game


def merge_game(db: Session, source: Game, target: Game) -> None:
    """Re-points every user-data row (library status, progress, play sessions, notes,
    tags) and any addon children from `source` onto `target`, then deletes `source` — for
    Link-to-IGDB's addon-parent flow, where the freshly-imported `target` row is always one
    `import_game_from_igdb` just created, so it starts with zero rows in any of these
    tables (import never creates user data, only catalog rows) — no merge-conflict
    handling needed."""
    db.execute(update(LibraryItem).where(LibraryItem.game_id == source.id).values(game_id=target.id))
    db.execute(update(GameProgress).where(GameProgress.game_id == source.id).values(game_id=target.id))
    db.execute(update(PlaySession).where(PlaySession.game_id == source.id).values(game_id=target.id))
    db.execute(update(Note).where(Note.game_id == source.id).values(game_id=target.id))
    db.execute(update(GameTag).where(GameTag.game_id == source.id).values(game_id=target.id))
    db.execute(update(Game).where(Game.parent_game_id == source.id).values(parent_game_id=target.id))
    db.delete(source)
    db.flush()


def delete_game_with_addons(db: Session, game: Game) -> None:
    """Deletes the game, its addons, and every row that hangs off either: library_items,
    game_progress, play_sessions, notes, game_tags, plus the catalog-richness tables
    populated at import/resync time (genres/companies/franchises/collections/platforms/
    screenshots/artworks/videos/release_dates)."""
    addon_ids = list(db.scalars(select(Game.id).where(Game.parent_game_id == game.id)))
    game_ids = [game.id, *addon_ids]

    db.execute(delete(LibraryItem).where(LibraryItem.game_id.in_(game_ids)))
    db.execute(delete(GameProgress).where(GameProgress.game_id.in_(game_ids)))
    db.execute(delete(PlaySession).where(PlaySession.game_id.in_(game_ids)))
    db.execute(delete(Note).where(Note.game_id.in_(game_ids)))
    db.execute(delete(GameTag).where(GameTag.game_id.in_(game_ids)))
    db.execute(delete(GameGenre).where(GameGenre.game_id.in_(game_ids)))
    db.execute(delete(GamePlatform).where(GamePlatform.game_id.in_(game_ids)))
    db.execute(delete(GameCompany).where(GameCompany.game_id.in_(game_ids)))
    db.execute(delete(GameFranchise).where(GameFranchise.game_id.in_(game_ids)))
    db.execute(delete(GameCollection).where(GameCollection.game_id.in_(game_ids)))
    db.execute(delete(Screenshot).where(Screenshot.game_id.in_(game_ids)))
    db.execute(delete(Artwork).where(Artwork.game_id.in_(game_ids)))
    db.execute(delete(GameVideo).where(GameVideo.game_id.in_(game_ids)))
    db.execute(delete(ReleaseDate).where(ReleaseDate.game_id.in_(game_ids)))
    db.execute(delete(Game).where(Game.id.in_(game_ids)))
