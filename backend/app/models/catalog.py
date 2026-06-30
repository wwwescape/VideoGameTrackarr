import enum
import uuid

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, enum_column


class GameCategory(enum.Enum):
    """Mirrors IGDB's numeric `games.category` field (id 0-14). Declaration order is load
    bearing — `from_igdb_category_id` indexes into `list(GameCategory)` by position, so
    members must stay in IGDB's exact numeric order; never reorder or insert in the middle."""

    MAIN_GAME = "main_game"
    DLC_ADDON = "dlc_addon"
    EXPANSION = "expansion"
    BUNDLE = "bundle"
    STANDALONE_EXPANSION = "standalone_expansion"
    MOD = "mod"
    EPISODE = "episode"
    SEASON = "season"
    REMAKE = "remake"
    REMASTER = "remaster"
    EXPANDED_GAME = "expanded_game"
    PORT = "port"
    FORK = "fork"
    PACK = "pack"
    UPDATE = "update"

    @classmethod
    def from_igdb_category_id(cls, igdb_category_id: int | None) -> "GameCategory | None":
        members = list(cls)
        if igdb_category_id is None or not (0 <= igdb_category_id < len(members)):
            return None
        return members[igdb_category_id]


class CompanyRole(enum.Enum):
    DEVELOPER = "developer"
    PUBLISHER = "publisher"
    PORTING = "porting"
    SUPPORTING = "supporting"


class Platform(TimestampMixin, Base):
    __tablename__ = "platforms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(255), index=True)
    abbreviation: Mapped[str | None] = mapped_column(String(50))
    logo_url: Mapped[str | None] = mapped_column(String(1024))


class Region(TimestampMixin, Base):
    """Physical/digital media region (PAL, NTSC-U, NTSC-J, ...) — a collection-tracking
    concept for the user's library, not something IGDB models directly."""

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class Genre(TimestampMixin, Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(255), index=True)


class Company(TimestampMixin, Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(255), index=True)
    logo_url: Mapped[str | None] = mapped_column(String(1024))


class Collection(TimestampMixin, Base):
    """IGDB 'collection' — a game series, e.g. Age of Empires Series."""

    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Unique (not just indexed) — this is the public lookup key for /api/collections/{slug}
    # now, not just a display nicety. NULLs don't conflict under a unique constraint, but in
    # practice IGDB always supplies one for collections.
    slug: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)


class Franchise(TimestampMixin, Base):
    __tablename__ = "franchises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Same reasoning as Collection.slug above — the public lookup key for /api/franchises/{slug}.
    slug: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)


class Game(TimestampMixin, Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4()))
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    # The public lookup key for /api/games/{slug} — populated from IGDB at sync time for
    # IGDB-sourced games; stays NULL for manually-added ones, which use {name-slug}-{uuid}
    # instead (see app/core/identifiers.py). NULLs don't conflict under a unique index.
    slug: Mapped[str | None] = mapped_column(String(512), unique=True, index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    storyline: Mapped[str | None] = mapped_column(Text)
    edition: Mapped[str | None] = mapped_column(
        String(255), comment="Free text, e.g. 'Game of the Year Edition' — only set for manually-added games"
    )
    igdb_url: Mapped[str | None] = mapped_column(String(1024))
    first_release_date: Mapped[int | None] = mapped_column(BigInteger)  # unix timestamp, from IGDB
    cover_url: Mapped[str | None] = mapped_column(String(1024))

    category: Mapped[GameCategory | None] = mapped_column(enum_column(GameCategory))
    igdb_category_id: Mapped[int | None] = mapped_column(Integer)

    parent_game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    # Distinct from parent_game_id above: set only for *non-hierarchical* relations — e.g. a
    # standalone expansion (Marvel's Spider-Man: Miles Morales) that's independently owned
    # and played, not DLC nested under an existing copy. We still want to show "Standalone
    # Expansion for Marvel's Spider-Man" with a working link, but parent_game_id drives
    # list_top_level_games' visibility filter and the delete/resync cascades — setting it
    # here would wrongly hide an independently-owned game from the main games list (this
    # broke Miles Morales the first time around). See _upsert_from_igdb_payload's
    # _HIERARCHICAL_ADDON_CATEGORIES for which categories use which column.
    display_parent_game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    # IGDB's parent_game backlink resolves to one of the two columns above when that parent
    # happens to be imported locally too — these two only get populated as a fallback, when
    # this game's conceptual parent (e.g. "Age of Empires" for the "Definitive Edition"
    # remaster) was never imported on its own. Cached at import/resync time rather than
    # fetched live, same as similar_game_igdb_ids below.
    external_parent_name: Mapped[str | None] = mapped_column(String(512))
    external_parent_igdb_url: Mapped[str | None] = mapped_column(String(1024))

    similar_game_igdb_ids: Mapped[list[int] | None] = mapped_column(
        JSON, comment="IGDB's similar_games field, cached at import/resync time — powers recommendations (M8)"
    )

    # Two self-referential FKs to the same table means SQLAlchemy can't infer which one each
    # relationship below is for — foreign_keys disambiguates explicitly.
    parent_game: Mapped["Game | None"] = relationship(
        remote_side="Game.id", foreign_keys=[parent_game_id], back_populates="addons"
    )
    addons: Mapped[list["Game"]] = relationship(foreign_keys=[parent_game_id], back_populates="parent_game")
    display_parent_game: Mapped["Game | None"] = relationship(
        remote_side="Game.id", foreign_keys=[display_parent_game_id]
    )

    genres: Mapped[list["GameGenre"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    platforms: Mapped[list["GamePlatform"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    companies: Mapped[list["GameCompany"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    franchises: Mapped[list["GameFranchise"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    collections: Mapped[list["GameCollection"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    screenshots: Mapped[list["Screenshot"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    videos: Mapped[list["GameVideo"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    artworks: Mapped[list["Artwork"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    release_dates: Mapped[list["ReleaseDate"]] = relationship(back_populates="game", cascade="all, delete-orphan")


class GameGenre(Base):
    __tablename__ = "game_genres"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    genre_id: Mapped[int] = mapped_column(ForeignKey("genres.id"), primary_key=True)

    game: Mapped["Game"] = relationship(back_populates="genres")
    genre: Mapped["Genre"] = relationship()


class GamePlatform(Base):
    """Which platforms a game was released on, per IGDB — distinct from `library_items`,
    which tracks which platform *the user's copy* is on."""

    __tablename__ = "game_platforms"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), primary_key=True)

    game: Mapped["Game"] = relationship(back_populates="platforms")
    platform: Mapped["Platform"] = relationship()


class GameCompany(Base):
    __tablename__ = "game_companies"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    role: Mapped[CompanyRole] = mapped_column(enum_column(CompanyRole), primary_key=True)

    game: Mapped["Game"] = relationship(back_populates="companies")
    company: Mapped["Company"] = relationship()


class GameFranchise(Base):
    __tablename__ = "game_franchises"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    franchise_id: Mapped[int] = mapped_column(ForeignKey("franchises.id"), primary_key=True)

    game: Mapped["Game"] = relationship(back_populates="franchises")
    franchise: Mapped["Franchise"] = relationship()


class GameCollection(Base):
    """Many-to-many, not a single FK on Game: IGDB's own API moved from a singular
    `collection` field to a plural `collections` array (verified live against the real
    API while building this) — a game can belong to more than one collection/series.
    Mirrors GameFranchise exactly."""

    __tablename__ = "game_collections"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("collections.id"), primary_key=True)

    game: Mapped["Game"] = relationship(back_populates="collections")
    collection: Mapped["Collection"] = relationship()


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)

    game: Mapped["Game"] = relationship(back_populates="screenshots")


class GameVideo(Base):
    __tablename__ = "game_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    name: Mapped[str | None] = mapped_column(String(255))
    video_id: Mapped[str] = mapped_column(String(255), nullable=False, comment="YouTube video id")

    game: Mapped["Game"] = relationship(back_populates="videos")


class Artwork(Base):
    __tablename__ = "artworks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)

    game: Mapped["Game"] = relationship(back_populates="artworks")


class IgdbReleaseRegion(enum.Enum):
    """IGDB's release_dates.release_region enum (1-indexed) — the geographic market a
    release date applies to (Europe/North America/Japan/Worldwide/...). Deliberately NOT
    the same thing as this app's `Region` model (PAL/NTSC-U/NTSC-J media-region tracking
    for the user's own physical/digital copies, see Region's docstring) — conflating the
    two would silently misrepresent both. A plain enum, not a table: IGDB's own enum is
    small and fixed, never user-edited, exactly like GameCategory."""

    EUROPE = "europe"
    NORTH_AMERICA = "north_america"
    AUSTRALIA = "australia"
    NEW_ZEALAND = "new_zealand"
    JAPAN = "japan"
    CHINA = "china"
    ASIA = "asia"
    WORLDWIDE = "worldwide"

    @classmethod
    def from_igdb_value(cls, value: int | None) -> "IgdbReleaseRegion | None":
        members = list(cls)
        if value is None or not (1 <= value <= len(members)):
            return None
        return members[value - 1]


class ReleaseDate(Base):
    """Per-platform, per-(IGDB geographic)-region release date, per IGDB's release_dates
    entity. A game can have more than one release_dates row for the same
    (platform, release_region) pair — e.g. a "Definitive Edition" re-release shipping a
    second date for the same platform/region under a different IGDB id — so igdb_id alone
    (already unique below) is the only real natural key here, not the combination."""

    __tablename__ = "release_dates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"))
    release_region: Mapped[IgdbReleaseRegion | None] = mapped_column(enum_column(IgdbReleaseRegion))
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    date: Mapped[int | None] = mapped_column(BigInteger, comment="unix timestamp")
    human: Mapped[str | None] = mapped_column(String(100), comment="IGDB's human-readable date string")

    game: Mapped["Game"] = relationship(back_populates="release_dates")
    platform: Mapped["Platform | None"] = relationship()
