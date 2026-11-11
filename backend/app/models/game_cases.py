from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class GameCase(TimestampMixin, Base):
    """Game Shelf: the standard game case of one platform, curated in
    docs/data/game_cases/Game_Cases.csv (seeded by migration, re-loaded with
    `python -m scripts.import_game_cases`). Every column but `shown` is reference data a
    re-import overwrites; `shown` is yours (Settings > Game Cases' Show on shelf switch).

    Matched to a platform by IGDB slug, ignoring IGDB's "--N" suffix. A platform with no row
    (cartridge-only systems) never appears on the shelf."""

    __tablename__ = "game_cases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    platform_slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    platform_name: Mapped[str] = mapped_column(String(255), nullable=False)
    case_label: Mapped[str] = mapped_column(String(64), nullable=False)
    height_mm: Mapped[float] = mapped_column(nullable=False)
    spine_mm: Mapped[float] = mapped_column(nullable=False)
    # How much of the case shows above the logo band (e.g. a PS3 case's clear top), in mm.
    case_top_mm: Mapped[float] = mapped_column(nullable=False, server_default="0")
    # "#rrggbb": the case itself (its edges and foot), the logo band at the top, and the title
    # band with the game's name.
    case_color: Mapped[str] = mapped_column(String(7), nullable=False)
    logo_band_color: Mapped[str] = mapped_column(String(7), nullable=False)
    # The logo band's share of the spine's height, in percent.
    logo_band_height_pct: Mapped[float] = mapped_column(nullable=False)
    # The spine logo: a file in frontend/assets/game-cases/; NULL shows the platform's short name.
    logo: Mapped[str | None] = mapped_column(String(64))
    # "#rrggbb" to draw the logo as a one-colour silhouette; NULL draws the file's own colours.
    logo_color: Mapped[str | None] = mapped_column(String(7))
    # "#rrggbb" of the thin line under the logo band (PS3's red, PS4's white); NULL for none.
    logo_line_color: Mapped[str | None] = mapped_column(String(7))
    title_band_color: Mapped[str] = mapped_column(String(7), nullable=False)
    title_text_color: Mapped[str] = mapped_column(String(7), nullable=False)
    shown: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
