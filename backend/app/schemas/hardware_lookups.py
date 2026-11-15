from app.schemas.base import CamelModel


class ManufacturerResponse(CamelModel):
    id: int
    name: str


class HardwarePlatformResponse(CamelModel):
    id: int
    name: str


class DeviceTypeResponse(CamelModel):
    id: int
    name: str


class AccessoryTypeResponse(CamelModel):
    id: int
    name: str


class StorageVariantResponse(CamelModel):
    id: int
    name: str


class ColorResponse(CamelModel):
    id: int
    name: str


class LibraryHardwarePlatformResponse(CamelModel):
    """A Hardware → Platforms card: a hardware platform with owned or wishlisted devices or
    accessories (an accessory counts on every platform it's compatible with)."""

    id: int
    name: str
    device_count: int
    accessory_count: int
    owned_count: int
    wishlisted_count: int
    image_urls: list[str]
