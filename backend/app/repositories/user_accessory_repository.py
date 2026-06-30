from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.hardware import Accessory, AccessoryCompatibility, UserAccessory
from app.models.library import LibraryStatus


def list_all_user_accessories(db: Session) -> list[UserAccessory]:
    """Every owned/wishlisted accessory row, for CSV export — not scoped to one accessory
    like list_user_accessories below. Eager-loads everything CSV export reads off of
    `accessory` (manufacturer/type/compatible platforms) so it isn't a lazy load per row."""
    stmt = (
        select(UserAccessory)
        .options(
            joinedload(UserAccessory.accessory).joinedload(Accessory.manufacturer),
            joinedload(UserAccessory.accessory).joinedload(Accessory.accessory_type),
            joinedload(UserAccessory.accessory)
            .selectinload(Accessory.compatible_platforms)
            .joinedload(AccessoryCompatibility.hardware_platform),
        )
        .join(Accessory, Accessory.id == UserAccessory.accessory_id)
        .order_by(Accessory.official_name)
    )
    return list(db.scalars(stmt))


def list_user_accessories(db: Session, accessory_id: int, status: LibraryStatus | None = None) -> list[UserAccessory]:
    stmt = select(UserAccessory).where(UserAccessory.accessory_id == accessory_id)
    if status is not None:
        stmt = stmt.where(UserAccessory.status == status)
    stmt = stmt.order_by(UserAccessory.id)
    return list(db.scalars(stmt))


def get_user_accessory(db: Session, item_id: int) -> UserAccessory | None:
    stmt = select(UserAccessory).options(joinedload(UserAccessory.accessory)).where(UserAccessory.id == item_id)
    return db.scalars(stmt).first()


def create_user_accessory(db: Session, **fields: Any) -> UserAccessory:
    item = UserAccessory(**fields)
    db.add(item)
    db.flush()
    return item


def update_user_accessory(db: Session, item: UserAccessory, **fields: Any) -> UserAccessory:
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_user_accessory(db: Session, item: UserAccessory) -> None:
    db.delete(item)
    db.flush()
