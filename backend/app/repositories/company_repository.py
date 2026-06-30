from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import Company, CompanyRole, GameCompany


def list_companies(db: Session) -> list[Company]:
    return list(db.scalars(select(Company).order_by(Company.name)))


def get_by_name(db: Session, name: str) -> Company | None:
    return db.scalars(select(Company).where(Company.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Company:
    # Manually-added games credit a developer/publisher by free text — same lenient
    # get-or-create pattern as platform_repository.get_or_create_by_name (CSV import).
    company = get_by_name(db, name)
    if company is not None:
        return company

    company = Company(name=name)
    db.add(company)
    db.flush()
    return company


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None, logo_url: str | None) -> Company:
    company = db.scalars(select(Company).where(Company.igdb_id == igdb_id)).first()
    if company is None:
        company = Company(igdb_id=igdb_id, name=name, slug=slug, logo_url=logo_url)
        db.add(company)
        db.flush()
        return company

    company.name = name
    company.slug = slug
    company.logo_url = logo_url
    db.flush()
    return company


def sync_for_game(db: Session, game_id: int, company_roles: list[tuple[int, CompanyRole]]) -> None:
    """Replaces this game's company/role associations wholesale (same resync semantics as
    genre_repository.sync_for_game). A company can appear more than once with different
    roles (e.g. both developer and publisher) — company_roles carries one row per role."""
    db.execute(delete(GameCompany).where(GameCompany.game_id == game_id))
    for company_id, role in company_roles:
        db.add(GameCompany(game_id=game_id, company_id=company_id, role=role))
    db.flush()
