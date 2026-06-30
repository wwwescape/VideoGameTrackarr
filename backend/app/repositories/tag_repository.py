from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.hardware import AccessoryTag, DeviceTag
from app.models.library import GameTag, Tag


def list_tags(db: Session) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.name)))


def get_tag(db: Session, tag_id: int) -> Tag | None:
    return db.scalars(select(Tag).where(Tag.id == tag_id)).first()


def get_tag_by_name(db: Session, name: str) -> Tag | None:
    return db.scalars(select(Tag).where(Tag.name == name)).first()


def create_tag(db: Session, name: str, color: str | None) -> Tag:
    tag = Tag(name=name, color=color)
    db.add(tag)
    db.flush()
    return tag


def delete_tag(db: Session, tag: Tag) -> None:
    db.execute(delete(GameTag).where(GameTag.tag_id == tag.id))
    db.execute(delete(DeviceTag).where(DeviceTag.tag_id == tag.id))
    db.execute(delete(AccessoryTag).where(AccessoryTag.tag_id == tag.id))
    db.delete(tag)
    db.flush()


def list_tags_for_game(db: Session, game_id: int) -> list[Tag]:
    stmt = select(Tag).join(GameTag, GameTag.tag_id == Tag.id).where(GameTag.game_id == game_id).order_by(Tag.name)
    return list(db.scalars(stmt))


def is_tag_attached(db: Session, game_id: int, tag_id: int) -> bool:
    stmt = select(GameTag).where(GameTag.game_id == game_id, GameTag.tag_id == tag_id)
    return db.scalars(stmt).first() is not None


def attach_tag(db: Session, game_id: int, tag_id: int) -> None:
    if is_tag_attached(db, game_id, tag_id):
        return
    db.add(GameTag(game_id=game_id, tag_id=tag_id))
    db.flush()


def detach_tag(db: Session, game_id: int, tag_id: int) -> None:
    db.execute(delete(GameTag).where(GameTag.game_id == game_id, GameTag.tag_id == tag_id))
    db.flush()


def list_tags_for_device(db: Session, device_id: int) -> list[Tag]:
    stmt = (
        select(Tag)
        .join(DeviceTag, DeviceTag.tag_id == Tag.id)
        .where(DeviceTag.device_id == device_id)
        .order_by(Tag.name)
    )
    return list(db.scalars(stmt))


def is_tag_attached_to_device(db: Session, device_id: int, tag_id: int) -> bool:
    stmt = select(DeviceTag).where(DeviceTag.device_id == device_id, DeviceTag.tag_id == tag_id)
    return db.scalars(stmt).first() is not None


def attach_tag_to_device(db: Session, device_id: int, tag_id: int) -> None:
    if is_tag_attached_to_device(db, device_id, tag_id):
        return
    db.add(DeviceTag(device_id=device_id, tag_id=tag_id))
    db.flush()


def detach_tag_from_device(db: Session, device_id: int, tag_id: int) -> None:
    db.execute(delete(DeviceTag).where(DeviceTag.device_id == device_id, DeviceTag.tag_id == tag_id))
    db.flush()


def list_tags_for_accessory(db: Session, accessory_id: int) -> list[Tag]:
    stmt = (
        select(Tag)
        .join(AccessoryTag, AccessoryTag.tag_id == Tag.id)
        .where(AccessoryTag.accessory_id == accessory_id)
        .order_by(Tag.name)
    )
    return list(db.scalars(stmt))


def is_tag_attached_to_accessory(db: Session, accessory_id: int, tag_id: int) -> bool:
    stmt = select(AccessoryTag).where(AccessoryTag.accessory_id == accessory_id, AccessoryTag.tag_id == tag_id)
    return db.scalars(stmt).first() is not None


def attach_tag_to_accessory(db: Session, accessory_id: int, tag_id: int) -> None:
    if is_tag_attached_to_accessory(db, accessory_id, tag_id):
        return
    db.add(AccessoryTag(accessory_id=accessory_id, tag_id=tag_id))
    db.flush()


def detach_tag_from_accessory(db: Session, accessory_id: int, tag_id: int) -> None:
    db.execute(delete(AccessoryTag).where(AccessoryTag.accessory_id == accessory_id, AccessoryTag.tag_id == tag_id))
    db.flush()
