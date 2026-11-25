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
    GameAddonLink,
    GameAlternativeName,
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
from app.models.documents import DocumentFormat, DocumentSource, HardwareDocumentKind  # noqa: F401
from app.models.events import Event, EventGame, EventNetwork, EventVideo  # noqa: F401
from app.models.game_cases import GameCase  # noqa: F401
from app.models.gog import GogDownload, GogLibraryEntry, GogWishlistEntry  # noqa: F401
from app.models.hardware import (  # noqa: F401
    Accessory,
    AccessoryCompatibility,
    AccessoryDeviceLink,
    AccessoryType,
    Color,
    Device,
    DeviceType,
    HardwareCondition,
    HardwareDocument,
    HardwarePlatform,
    Manufacturer,
    StorageVariant,
    UserAccessory,
    UserDevice,
)
from app.models.igdb_import import IgdbImportEntry  # noqa: F401
from app.models.itad import ItadPriceCache  # noqa: F401
from app.models.jobs import JobRunLog, JobSchedule  # noqa: F401
from app.models.labs import LabFeature  # noqa: F401
from app.models.library import (  # noqa: F401
    BiosFile,
    GameDocument,
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
    RomFile,
    RomSaveState,
    Tag,
)
from app.models.platprices import PlatPricesCache  # noqa: F401
from app.models.steam import SteamLibraryEntry  # noqa: F401
from app.models.system import RefreshToken, User  # noqa: F401
from app.models.toys_to_life import (  # noqa: F401
    ToysToLifeCopy,
    ToysToLifeDocument,
    ToysToLifeItem,
    ToysToLifeNote,
    ToysToLifeTag,
)

__all__ = ["Base"]
