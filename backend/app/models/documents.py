"""What the three document tables share: game_documents (Guides & Cheats), hardware_documents
(devices and accessories) and toys_to_life_documents. Each entry is an uploaded file, stored
privately and served only through signed links (see app/services/document_files.py), or a
saved link. None of them is ever shown on a share page."""

import enum

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.mixins import enum_column


class DocumentSource(enum.Enum):
    FILE = "file"
    LINK = "link"


class DocumentFormat(enum.Enum):
    PDF = "pdf"
    DOCX = "docx"
    MD = "md"
    TXT = "txt"
    JPG = "jpg"
    PNG = "png"
    WEBP = "webp"


IMAGE_FORMATS = frozenset({DocumentFormat.JPG, DocumentFormat.PNG, DocumentFormat.WEBP})


class HardwareDocumentKind(enum.Enum):
    """The types on a device, accessory or Toys-to-Life item, in the order they're listed."""

    MANUAL = "manual"
    QUICK_START = "quick_start"
    RECEIPT = "receipt"
    WARRANTY = "warranty"
    REPAIR = "repair"
    OTHER = "other"


# Toys-to-Life packs offer only these of the hardware types (packs have no quick-start sheets,
# warranties or repairs); the column shares HardwareDocumentKind's values.
TOYS_TO_LIFE_KINDS = (HardwareDocumentKind.MANUAL, HardwareDocumentKind.RECEIPT, HardwareDocumentKind.OTHER)

# A link has a URL and no file; a file has a file and no URL. Each table adds it as its own
# CheckConstraint(name="source") → ck_<table>_source.
SOURCE_CHECK = (
    "(source = 'link' AND url IS NOT NULL AND stored_filename IS NULL)"
    " OR (source = 'file' AND url IS NULL AND stored_filename IS NOT NULL)"
)


class DocumentColumnsMixin:
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[DocumentSource] = mapped_column(enum_column(DocumentSource), nullable=False)
    url: Mapped[str | None] = mapped_column(String(2048))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    stored_filename: Mapped[str | None] = mapped_column(
        String(64), comment="uuid-based name on disk — never derived from user input"
    )
    rendered_filename: Mapped[str | None] = mapped_column(
        String(64), comment="sanitised HTML (docx/md) or UTF-8 copy (non-UTF-8 txt), rebuilt on restore"
    )
    media_format: Mapped[DocumentFormat | None] = mapped_column(enum_column(DocumentFormat))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
