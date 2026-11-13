from app.schemas.base import CamelModel


class LinkedHardwareResponse(CamelModel):
    """A device or accessory linked to the one being viewed, with what its card shows (the same
    as on the Hardware page): photo, name, "manufacturer · detail", owned/wishlisted marks and
    the Custom chip. Built by device_schema.linked_device_from_orm /
    accessory_schema.linked_accessory_from_orm from rows loaded with their status."""

    id: int
    uuid: str
    official_name: str
    manufacturer_name: str
    # The card's second line after the manufacturer: a device's platform, an accessory's type.
    detail: str | None
    image_url: str | None
    is_custom: bool
    owned: bool
    wishlisted: bool
