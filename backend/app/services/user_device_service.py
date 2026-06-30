from typing import Any

from sqlalchemy.orm import Session

from app.models.hardware import UserDevice
from app.models.library import LibraryStatus
from app.repositories import device_repository, user_device_repository
from app.services.exceptions import NotFoundError


def list_user_devices(db: Session, device_id: int, status: LibraryStatus | None = None) -> list[UserDevice]:
    _require_device(db, device_id)
    return user_device_repository.list_user_devices(db, device_id, status=status)


def add_user_device(db: Session, device_id: int, **fields: Any) -> UserDevice:
    _require_device(db, device_id)
    item = user_device_repository.create_user_device(db, device_id=device_id, **fields)
    db.commit()
    db.refresh(item)
    return item


def update_user_device(db: Session, item_id: int, **fields: Any) -> UserDevice:
    item = _require_user_device(db, item_id)
    item = user_device_repository.update_user_device(db, item, **fields)
    db.commit()
    db.refresh(item)
    return item


def delete_user_device(db: Session, item_id: int) -> None:
    item = _require_user_device(db, item_id)
    user_device_repository.delete_user_device(db, item)
    db.commit()


def _require_device(db: Session, device_id: int) -> None:
    if device_repository.get_device(db, device_id) is None:
        raise NotFoundError(f"Device {device_id} not found")


def _require_user_device(db: Session, item_id: int) -> UserDevice:
    item = user_device_repository.get_user_device(db, item_id)
    if item is None:
        raise NotFoundError(f"User device {item_id} not found")
    return item
