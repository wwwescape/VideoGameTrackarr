from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.system import User
from app.schemas.integrations import IntegrationsStatusResponse


def get_status(user: User) -> IntegrationsStatusResponse:
    settings = get_settings()
    return IntegrationsStatusResponse(
        igdb_configured=bool(settings.igdb_client_id and settings.igdb_client_secret),
        steam_api_key_configured=bool(settings.steam_api_key),
        steam_id_64=user.steam_id_64,
        itad_configured=bool(settings.itad_api_key),
        platprices_configured=bool(settings.platprices_api_key),
    )


def set_steam_id(db: Session, user: User, steam_id_64: str | None) -> User:
    user.steam_id_64 = steam_id_64
    db.commit()
    db.refresh(user)
    return user
