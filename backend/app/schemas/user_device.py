from app.models.hardware import HardwareCondition, UserDevice
from app.models.library import LibraryStatus
from app.schemas.base import CamelModel


class UserDeviceResponse(CamelModel):
    id: int
    device_id: int
    status: LibraryStatus
    condition: HardwareCondition | None
    purchase_price: float | None
    serial_number: str | None
    notes: str | None


def user_device_from_orm(item: UserDevice) -> UserDeviceResponse:
    return UserDeviceResponse(
        id=item.id,
        device_id=item.device_id,
        status=item.status,
        condition=item.condition,
        purchase_price=item.purchase_price,
        serial_number=item.serial_number,
        notes=item.notes,
    )


class UserDeviceCreateRequest(CamelModel):
    status: LibraryStatus
    condition: HardwareCondition | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None


class UserDeviceUpdateRequest(CamelModel):
    status: LibraryStatus | None = None
    condition: HardwareCondition | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None
