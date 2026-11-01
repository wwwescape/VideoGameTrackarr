from dataclasses import dataclass


@dataclass(frozen=True)
class ToysToLifeLine:
    slug: str
    name: str
    # The game the line's packs extend — what a pack's "Toy to Life of" chip points at, and
    # whose game page lists the line's packs instead of IGDB's add-on rows for them.
    parent_igdb_id: int
    # Seed file under docs/data/toys_to_life/.
    csv_filename: str


# Every Toys-to-Life line the app tracks, in nav order. Adding one is a new CSV, an entry
# here and a seed migration; its images go in backend/static/toys-to-life/<slug>/.
LINES: tuple[ToysToLifeLine, ...] = (
    ToysToLifeLine(
        slug="lego-dimensions",
        name="LEGO Dimensions",
        parent_igdb_id=11077,
        csv_filename="LEGO_Dimensions_Packs.csv",
    ),
)

_BY_SLUG = {line.slug: line for line in LINES}


def get_line(slug: str) -> ToysToLifeLine | None:
    return _BY_SLUG.get(slug)


def line_for_parent_igdb_id(igdb_id: int | None) -> ToysToLifeLine | None:
    return next((line for line in LINES if line.parent_igdb_id == igdb_id), None) if igdb_id else None
