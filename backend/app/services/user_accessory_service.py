from typing import Any

from sqlalchemy.orm import Session

from app.models.hardware import UserAccessory
from app.models.library import LibraryStatus
from app.repositories import accessory_repository, user_accessory_repository
from app.services.exceptions import NotFoundError


def list_user_accessories(db: Session, accessory_id: int, status: LibraryStatus | None = None) -> list[UserAccessory]:
    _require_accessory(db, accessory_id)
    return user_accessory_repository.list_user_accessories(db, accessory_id, status=status)


def add_user_accessory(db: Session, accessory_id: int, **fields: Any) -> UserAccessory:
    _require_accessory(db, accessory_id)
    item = user_accessory_repository.create_user_accessory(db, accessory_id=accessory_id, **fields)
    db.commit()
    db.refresh(item)
    return item


def update_user_accessory(db: Session, item_id: int, **fields: Any) -> UserAccessory:
    item = _require_user_accessory(db, item_id)
    item = user_accessory_repository.update_user_accessory(db, item, **fields)
    db.commit()
    db.refresh(item)
    return item


def delete_user_accessory(db: Session, item_id: int) -> None:
    item = _require_user_accessory(db, item_id)
    user_accessory_repository.delete_user_accessory(db, item)
    db.commit()


def _require_accessory(db: Session, accessory_id: int) -> None:
    if accessory_repository.get_accessory(db, accessory_id) is None:
        raise NotFoundError(f"Accessory {accessory_id} not found")


def _require_user_accessory(db: Session, item_id: int) -> UserAccessory:
    item = user_accessory_repository.get_user_accessory(db, item_id)
    if item is None:
        raise NotFoundError(f"User accessory {item_id} not found")
    return item
