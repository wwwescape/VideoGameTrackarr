from sqlalchemy.orm import Session

from app.models.library import Tag
from app.repositories import accessory_repository, device_repository, game_repository, tag_repository
from app.services.exceptions import NotFoundError


def list_tags(db: Session) -> list[Tag]:
    return tag_repository.list_tags(db)


def create_tag(db: Session, name: str, color: str | None) -> Tag:
    # Get-or-create: tags are lightweight labels, not user-owned records worth a 409 over —
    # if the name already exists, reuse it rather than making the caller handle a conflict.
    existing = tag_repository.get_tag_by_name(db, name)
    if existing is not None:
        return existing

    tag = tag_repository.create_tag(db, name, color)
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag_id: int) -> None:
    tag = _require_tag(db, tag_id)
    tag_repository.delete_tag(db, tag)
    db.commit()


def list_tags_for_game(db: Session, game_id: int) -> list[Tag]:
    _require_game(db, game_id)
    return tag_repository.list_tags_for_game(db, game_id)


def attach_tag(db: Session, game_id: int, tag_id: int) -> list[Tag]:
    _require_game(db, game_id)
    _require_tag(db, tag_id)
    tag_repository.attach_tag(db, game_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_game(db, game_id)


def detach_tag(db: Session, game_id: int, tag_id: int) -> list[Tag]:
    _require_game(db, game_id)
    tag_repository.detach_tag(db, game_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_game(db, game_id)


def list_tags_for_device(db: Session, device_id: int) -> list[Tag]:
    _require_device(db, device_id)
    return tag_repository.list_tags_for_device(db, device_id)


def attach_tag_to_device(db: Session, device_id: int, tag_id: int) -> list[Tag]:
    _require_device(db, device_id)
    _require_tag(db, tag_id)
    tag_repository.attach_tag_to_device(db, device_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_device(db, device_id)


def detach_tag_from_device(db: Session, device_id: int, tag_id: int) -> list[Tag]:
    _require_device(db, device_id)
    tag_repository.detach_tag_from_device(db, device_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_device(db, device_id)


def list_tags_for_accessory(db: Session, accessory_id: int) -> list[Tag]:
    _require_accessory(db, accessory_id)
    return tag_repository.list_tags_for_accessory(db, accessory_id)


def attach_tag_to_accessory(db: Session, accessory_id: int, tag_id: int) -> list[Tag]:
    _require_accessory(db, accessory_id)
    _require_tag(db, tag_id)
    tag_repository.attach_tag_to_accessory(db, accessory_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_accessory(db, accessory_id)


def detach_tag_from_accessory(db: Session, accessory_id: int, tag_id: int) -> list[Tag]:
    _require_accessory(db, accessory_id)
    tag_repository.detach_tag_from_accessory(db, accessory_id, tag_id)
    db.commit()
    return tag_repository.list_tags_for_accessory(db, accessory_id)


def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_device(db: Session, device_id: int) -> None:
    if device_repository.get_device(db, device_id) is None:
        raise NotFoundError(f"Device {device_id} not found")


def _require_accessory(db: Session, accessory_id: int) -> None:
    if accessory_repository.get_accessory(db, accessory_id) is None:
        raise NotFoundError(f"Accessory {accessory_id} not found")


def _require_tag(db: Session, tag_id: int) -> Tag:
    tag = tag_repository.get_tag(db, tag_id)
    if tag is None:
        raise NotFoundError(f"Tag {tag_id} not found")
    return tag
