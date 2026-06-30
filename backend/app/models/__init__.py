"""Import every model module so they register on Base.metadata — required for Alembic
autogenerate and for the cross-module string-based relationship() references to resolve."""

from app.db.base import Base
from app.models.catalog import (  # noqa: F401
    Artwork,
    Collection,
    Company,
    CompanyRole,
    Franchise,
    Game,
    GameCategory,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    Genre,
    IgdbReleaseRegion,
    Platform,
    Region,
    ReleaseDate,
    Screenshot,
)
from app.models.hardware import (  # noqa: F401
    Accessory,
    AccessoryCompatibility,
    AccessoryDeviceLink,
    AccessoryType,
    Color,
    Device,
    DeviceType,
    HardwareCondition,
    HardwarePlatform,
    Manufacturer,
    StorageVariant,
    UserAccessory,
    UserDevice,
)
from app.models.library import (  # noqa: F401
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
    Tag,
)
from app.models.system import RefreshToken, User  # noqa: F401

__all__ = ["Base"]
