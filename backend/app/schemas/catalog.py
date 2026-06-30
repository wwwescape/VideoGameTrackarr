from app.models.catalog import (
    Collection,
    CompanyRole,
    Franchise,
    GameCompany,
    GameVideo,
    Genre,
    IgdbReleaseRegion,
    ReleaseDate,
)
from app.schemas.base import CamelModel


class CatalogRefResponse(CamelModel):
    """Shared id+name+slug shape for genre/franchise/collection references attached to a
    game — enough to display and (for franchise/collection) link to a browse page."""

    id: int
    name: str
    slug: str | None


def genre_ref_from_orm(genre: Genre) -> CatalogRefResponse:
    return CatalogRefResponse(id=genre.id, name=genre.name, slug=genre.slug)


def franchise_ref_from_orm(franchise: Franchise) -> CatalogRefResponse:
    return CatalogRefResponse(id=franchise.id, name=franchise.name, slug=franchise.slug)


def collection_ref_from_orm(collection: Collection) -> CatalogRefResponse:
    return CatalogRefResponse(id=collection.id, name=collection.name, slug=collection.slug)


class GameCompanyResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    logo_url: str | None
    role: CompanyRole


def game_company_from_orm(game_company: GameCompany) -> GameCompanyResponse:
    company = game_company.company
    return GameCompanyResponse(
        id=company.id, name=company.name, slug=company.slug, logo_url=company.logo_url, role=game_company.role
    )


class GameVideoResponse(CamelModel):
    id: int
    name: str | None
    video_id: str


def game_video_from_orm(video: GameVideo) -> GameVideoResponse:
    return GameVideoResponse(id=video.id, name=video.name, video_id=video.video_id)


class ReleaseDateResponse(CamelModel):
    id: int
    date: int | None
    human: str | None
    platform_name: str | None
    release_region: IgdbReleaseRegion | None


def release_date_from_orm(release_date: ReleaseDate) -> ReleaseDateResponse:
    return ReleaseDateResponse(
        id=release_date.id,
        date=release_date.date,
        human=release_date.human,
        platform_name=release_date.platform.name if release_date.platform else None,
        release_region=release_date.release_region,
    )
