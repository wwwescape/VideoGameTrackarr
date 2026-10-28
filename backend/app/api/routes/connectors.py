from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.models.connector import Connector
from app.repositories import connector_repository
from app.schemas.connector import (
    ConnectorCreateRequest,
    ConnectorDeviceResponse,
    ConnectorGameResponse,
    ConnectorRequest,
    ConnectorResponse,
    ImportGamesRequest,
    PairingInfoResponse,
    StoreLoginUrlResponse,
    StoreSignInRequest,
    SyncResponse,
)
from app.services import connector_pull_jobs, connector_service, job_registry
from app.services.connector_service import ReportedGame
from app.services.store_clients import StoreLoginError

router = APIRouter(prefix="/api/connectors", tags=["connectors"], dependencies=[Depends(get_current_user)])


def _response(db: Session, connector: Connector) -> ConnectorResponse:
    return ConnectorResponse(
        id=connector.id,
        name=connector.name,
        slug=connector.slug,
        kind=connector.kind,
        platform_id=connector.platform_id,
        media_format=connector.media_format,
        digital_storefront=connector.digital_storefront,
        wishlist=connector.wishlist,
        absent_mode=connector.absent_mode,
        last_sync_at=connector.last_sync_at,
        last_sync_result=connector.last_sync_result,
        devices=[ConnectorDeviceResponse.model_validate(device, from_attributes=True) for device in connector.devices],
        signed_in=bool(connector.credentials),
        present_count=connector_repository.count_games(db, connector.id, present=True),
        absent_count=connector_repository.count_games(db, connector.id, present=False),
    )


def _fields(body: ConnectorRequest) -> dict:
    fields = body.model_dump(exclude={"kind"})
    fields["media_format"] = body.media_format.value if body.media_format else None
    return fields


@router.get("", response_model=list[ConnectorResponse])
def list_connectors(db: Session = Depends(get_db)) -> list[ConnectorResponse]:
    return [_response(db, connector) for connector in connector_service.list_connectors(db)]


@router.post("", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
def create_connector(body: ConnectorCreateRequest, db: Session = Depends(get_db)) -> ConnectorResponse:
    return _response(db, connector_service.create_connector(db, kind=body.kind, **_fields(body)))


@router.put("/{connector_id}", response_model=ConnectorResponse)
def update_connector(connector_id: int, body: ConnectorRequest, db: Session = Depends(get_db)) -> ConnectorResponse:
    return _response(db, connector_service.update_connector(db, connector_id, **_fields(body)))


@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connector(connector_id: int, db: Session = Depends(get_db)) -> Response:
    connector_service.delete_connector(db, connector_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{connector_id}/games", response_model=list[ConnectorGameResponse])
def list_connector_games(connector_id: int, db: Session = Depends(get_db)) -> list[ConnectorGameResponse]:
    return [
        ConnectorGameResponse.model_validate(game, from_attributes=True)
        for game in connector_repository.list_games(db, connector_id)
    ]


@router.delete("/{connector_id}/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device(connector_id: int, device_id: int, db: Session = Depends(get_db)) -> Response:
    connector_service.revoke_device(db, connector_id, device_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/pairings/{code}", response_model=PairingInfoResponse)
def get_pairing(code: str, db: Session = Depends(get_db)) -> PairingInfoResponse:
    pairing, connector = connector_service.get_pairing(db, code)
    return PairingInfoResponse(
        code=pairing.code,
        device_name=pairing.device_name,
        connector_id=connector.id,
        connector_name=connector.name,
        expires_at=pairing.expires_at,
    )


@router.post("/pairings/{code}/approve", response_model=ConnectorDeviceResponse)
def approve_pairing(code: str, db: Session = Depends(get_db)) -> ConnectorDeviceResponse:
    return ConnectorDeviceResponse.model_validate(connector_service.approve_pairing(db, code), from_attributes=True)


@router.get("/{connector_id}/login-url", response_model=StoreLoginUrlResponse)
def store_login_url(connector_id: int, db: Session = Depends(get_db)) -> StoreLoginUrlResponse:
    return StoreLoginUrlResponse(url=connector_service.login_url(db, connector_id))


@router.post("/{connector_id}/sign-in", response_model=ConnectorResponse)
async def store_sign_in(
    connector_id: int, body: StoreSignInRequest, db: Session = Depends(get_db)
) -> ConnectorResponse:
    try:
        connector = await connector_service.sign_in(db, connector_id, body.code)
    except StoreLoginError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _response(db, connector)


@router.post("/sync-stores", status_code=status.HTTP_202_ACCEPTED)
def sync_stores(session_factory: Callable[[], Session] = Depends(get_session_factory)) -> Response:
    """Starts the store sync job now (every signed-in Epic/GOG connector), as the Jobs page
    would; its progress shows there."""
    job_registry.trigger_run(connector_pull_jobs.JOB_CONNECTORS_PULL, session_factory)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post("/{connector_id}/import", response_model=SyncResponse)
def import_games(
    connector_id: int,
    body: ImportGamesRequest,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> SyncResponse:
    games = [ReportedGame(external_id=g.id, name=g.name, igdb_id=g.igdb_id, players=g.players) for g in body.games]
    return SyncResponse(**connector_service.import_games(db, connector_id, games, session_factory).as_dict())
