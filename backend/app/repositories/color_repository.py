from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import Color


def list_colors(db: Session) -> list[Color]:
    return list(db.scalars(select(Color).order_by(Color.name)))


def get_by_name(db: Session, name: str) -> Color | None:
    return db.scalars(select(Color).where(Color.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Color:
    color = get_by_name(db, name)
    if color is not None:
        return color

    color = Color(name=name)
    db.add(color)
    db.flush()
    return color
