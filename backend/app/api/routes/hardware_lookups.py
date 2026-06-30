from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import (
    accessory_type_repository,
    color_repository,
    device_type_repository,
    hardware_platform_repository,
    hardware_reference_repository,
    manufacturer_repository,
    storage_variant_repository,
)
from app.schemas.hardware_lookups import (
    AccessoryTypeResponse,
    ColorResponse,
    DeviceTypeResponse,
    HardwarePlatformResponse,
    ManufacturerResponse,
    StorageVariantResponse,
)
from app.schemas.hardware_reference import HardwareReferenceEntryResponse, hardware_reference_entry_from_orm

router = APIRouter(prefix="/api", tags=["hardware-lookups"], dependencies=[Depends(get_current_user)])


@router.get("/manufacturers", response_model=list[ManufacturerResponse])
def list_manufacturers(db: Session = Depends(get_db)) -> list[ManufacturerResponse]:
    manufacturers = manufacturer_repository.list_manufacturers(db)
    return [ManufacturerResponse.model_validate(manufacturer) for manufacturer in manufacturers]


@router.get("/hardware-platforms", response_model=list[HardwarePlatformResponse])
def list_hardware_platforms(db: Session = Depends(get_db)) -> list[HardwarePlatformResponse]:
    platforms = hardware_platform_repository.list_hardware_platforms(db)
    return [HardwarePlatformResponse.model_validate(platform) for platform in platforms]


@router.get("/device-types", response_model=list[DeviceTypeResponse])
def list_device_types(db: Session = Depends(get_db)) -> list[DeviceTypeResponse]:
    device_types = device_type_repository.list_device_types(db)
    return [DeviceTypeResponse.model_validate(device_type) for device_type in device_types]


@router.get("/accessory-types", response_model=list[AccessoryTypeResponse])
def list_accessory_types(db: Session = Depends(get_db)) -> list[AccessoryTypeResponse]:
    accessory_types = accessory_type_repository.list_accessory_types(db)
    return [AccessoryTypeResponse.model_validate(accessory_type) for accessory_type in accessory_types]


@router.get("/storage-variants", response_model=list[StorageVariantResponse])
def list_storage_variants(db: Session = Depends(get_db)) -> list[StorageVariantResponse]:
    storage_variants = storage_variant_repository.list_storage_variants(db)
    return [StorageVariantResponse.model_validate(storage_variant) for storage_variant in storage_variants]


@router.get("/colors", response_model=list[ColorResponse])
def list_colors(db: Session = Depends(get_db)) -> list[ColorResponse]:
    colors = color_repository.list_colors(db)
    return [ColorResponse.model_validate(color) for color in colors]


@router.get("/hardware-reference-entries", response_model=list[HardwareReferenceEntryResponse])
def list_hardware_reference_entries(
    entry_type: str | None = Query(default=None, alias="type"), db: Session = Depends(get_db)
) -> list[HardwareReferenceEntryResponse]:
    entries = hardware_reference_repository.list_entries(db, entry_type=entry_type)
    return [hardware_reference_entry_from_orm(entry) for entry in entries]
