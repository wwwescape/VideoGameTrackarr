from collections.abc import Callable

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.models.connector import Connector, ConnectorKind
from app.repositories import connector_repository
from app.schemas.connector import (
    ConnectorCreateRequest,
    ConnectorDeviceResponse,
    ConnectorGameResponse,
    ConnectorRequest,
    ConnectorResponse,
    PairingInfoResponse,
)
from app.services import connector_service, job_registry, nintendo_titledb, nintendo_titledb_jobs
from app.services.exceptions import ConflictError

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
def create_connector(
    body: ConnectorCreateRequest,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> ConnectorResponse:
    connector = connector_service.create_connector(db, kind=body.kind, **_fields(body))
    # An NX Remote Launcher connector needs the Nintendo title list before its first sync.
    if connector.kind == ConnectorKind.NX_REMOTE_LAUNCHER and not nintendo_titledb.load_index():
        try:
            job_registry.trigger_run(nintendo_titledb_jobs.JOB_NINTENDO_TITLEDB, session_factory)
        except ConflictError:
            pass
    return _response(db, connector)


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
