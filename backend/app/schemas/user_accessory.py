from app.models.hardware import HardwareCondition, UserAccessory
from app.models.library import LibraryStatus
from app.schemas.base import CamelModel


class UserAccessoryResponse(CamelModel):
    id: int
    accessory_id: int
    status: LibraryStatus
    condition: HardwareCondition | None
    purchase_price: float | None
    serial_number: str | None
    notes: str | None


def user_accessory_from_orm(item: UserAccessory) -> UserAccessoryResponse:
    return UserAccessoryResponse(
        id=item.id,
        accessory_id=item.accessory_id,
        status=item.status,
        condition=item.condition,
        purchase_price=item.purchase_price,
        serial_number=item.serial_number,
        notes=item.notes,
    )


class UserAccessoryCreateRequest(CamelModel):
    status: LibraryStatus
    condition: HardwareCondition | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None


class UserAccessoryUpdateRequest(CamelModel):
    status: LibraryStatus | None = None
    condition: HardwareCondition | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None
