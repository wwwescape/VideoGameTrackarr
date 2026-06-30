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
