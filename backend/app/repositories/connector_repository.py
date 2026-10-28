from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.connector import Connector, ConnectorDevice, ConnectorGame, ConnectorKind, ConnectorPairing

# Repositories only add/flush/delete — they never commit (see game_repository.py).


def list_connectors(db: Session) -> list[Connector]:
    return list(db.scalars(select(Connector).order_by(Connector.name)))


def get_connector(db: Session, connector_id: int) -> Connector | None:
    return db.get(Connector, connector_id)


def get_connector_by_slug(db: Session, slug: str) -> Connector | None:
    return db.scalars(select(Connector).where(Connector.slug == slug)).first()


def count_games(db: Session, connector_id: int, present: bool) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ConnectorGame)
        .where(ConnectorGame.connector_id == connector_id, ConnectorGame.present.is_(present))
    ) or 0


def list_games(db: Session, connector_id: int) -> list[ConnectorGame]:
    return list(
        db.scalars(select(ConnectorGame).where(ConnectorGame.connector_id == connector_id).order_by(ConnectorGame.name))
    )


def games_by_external_id(db: Session, connector_id: int) -> dict[str, ConnectorGame]:
    return {game.external_id: game for game in list_games(db, connector_id)}


def get_device_by_token_hash(db: Session, connector_id: int, token_hash: str) -> ConnectorDevice | None:
    return db.scalars(
        select(ConnectorDevice).where(
            ConnectorDevice.connector_id == connector_id, ConnectorDevice.token_hash == token_hash
        )
    ).first()


def get_pairing_by_code(db: Session, code: str) -> ConnectorPairing | None:
    return db.scalars(select(ConnectorPairing).where(ConnectorPairing.code == code)).first()


def get_pairing_by_poll_token_hash(db: Session, connector_id: int, poll_token_hash: str) -> ConnectorPairing | None:
    return db.scalars(
        select(ConnectorPairing).where(
            ConnectorPairing.connector_id == connector_id, ConnectorPairing.poll_token_hash == poll_token_hash
        )
    ).first()


def delete_expired_pairings(db: Session, now: datetime) -> None:
    for pairing in db.scalars(select(ConnectorPairing).where(ConnectorPairing.expires_at < now)):
        db.delete(pairing)


def nintendo_title_ids_by_game(db: Session) -> dict[int, list[str]]:
    """The Switch title IDs NX Remote Launcher connectors reported, per library game."""
    rows = db.execute(
        select(ConnectorGame.game_id, ConnectorGame.external_id)
        .join(Connector, Connector.id == ConnectorGame.connector_id)
        .where(Connector.kind == ConnectorKind.NX_REMOTE_LAUNCHER, ConnectorGame.game_id.is_not(None))
    )
    title_ids: dict[int, list[str]] = {}
    for game_id, external_id in rows:
        title_ids.setdefault(game_id, []).append(external_id)
    return title_ids
