"""add hardware_documents and toys_to_life_documents

Revision ID: c9e1a3b5d7f2
Revises: b8d0f2a4c6e1
Create Date: 2026-11-25 12:10:00.000000

Manuals & Documents: manuals, receipts, warranty cards and other documents kept with a
device, accessory or Toys-to-Life pack, each an uploaded file (stored privately under
uploads/documents/) or a saved link. A document can name the owned copy it's for.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e1a3b5d7f2'
down_revision: Union[str, None] = 'b8d0f2a4c6e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_KINDS = ("manual", "quick_start", "receipt", "warranty", "repair", "other")
_FORMATS = ("pdf", "docx", "md", "txt", "jpg", "png", "webp")
_SOURCE_CHECK = (
    "(source = 'link' AND url IS NOT NULL AND stored_filename IS NULL)"
    " OR (source = 'file' AND url IS NULL AND stored_filename IS NOT NULL)"
)


def _document_columns() -> list[sa.Column]:
    return [
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(*_KINDS, name="hardwaredocumentkind", native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum("file", "link", name="documentsource", native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column(
            "stored_filename",
            sa.String(length=64),
            nullable=True,
            comment="uuid-based name on disk — never derived from user input",
        ),
        sa.Column(
            "rendered_filename",
            sa.String(length=64),
            nullable=True,
            comment="sanitised HTML (docx/md) or UTF-8 copy (non-UTF-8 txt), rebuilt on restore",
        ),
        sa.Column(
            "media_format",
            sa.Enum(*_FORMATS, name="documentformat", native_enum=False, create_constraint=True),
            nullable=True,
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "hardware_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("accessory_id", sa.Integer(), nullable=True),
        sa.Column("user_device_id", sa.Integer(), nullable=True),
        sa.Column("user_accessory_id", sa.Integer(), nullable=True),
        *_document_columns(),
        sa.CheckConstraint(_SOURCE_CHECK, name=op.f("ck_hardware_documents_source")),
        sa.CheckConstraint("(device_id IS NULL) <> (accessory_id IS NULL)", name=op.f("ck_hardware_documents_owner")),
        sa.CheckConstraint(
            "(user_device_id IS NULL OR device_id IS NOT NULL)"
            " AND (user_accessory_id IS NULL OR accessory_id IS NOT NULL)",
            name=op.f("ck_hardware_documents_copy"),
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name=op.f("fk_hardware_documents_device_id_devices")),
        sa.ForeignKeyConstraint(
            ["accessory_id"], ["accessories.id"], name=op.f("fk_hardware_documents_accessory_id_accessories")
        ),
        sa.ForeignKeyConstraint(
            ["user_device_id"], ["user_devices.id"], name=op.f("fk_hardware_documents_user_device_id_user_devices")
        ),
        sa.ForeignKeyConstraint(
            ["user_accessory_id"],
            ["user_accessories.id"],
            name=op.f("fk_hardware_documents_user_accessory_id_user_accessories"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_hardware_documents")),
    )
    op.create_index(op.f("ix_hardware_documents_device_id"), "hardware_documents", ["device_id"])
    op.create_index(op.f("ix_hardware_documents_accessory_id"), "hardware_documents", ["accessory_id"])

    op.create_table(
        "toys_to_life_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=True),
        *_document_columns(),
        sa.CheckConstraint(_SOURCE_CHECK, name=op.f("ck_toys_to_life_documents_source")),
        sa.ForeignKeyConstraint(
            ["item_id"], ["toys_to_life_items.id"], name=op.f("fk_toys_to_life_documents_item_id_toys_to_life_items")
        ),
        sa.ForeignKeyConstraint(
            ["copy_id"],
            ["toys_to_life_copies.id"],
            name=op.f("fk_toys_to_life_documents_copy_id_toys_to_life_copies"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_toys_to_life_documents")),
    )
    op.create_index(op.f("ix_toys_to_life_documents_item_id"), "toys_to_life_documents", ["item_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_toys_to_life_documents_item_id"), table_name="toys_to_life_documents")
    op.drop_table("toys_to_life_documents")
    op.drop_index(op.f("ix_hardware_documents_accessory_id"), table_name="hardware_documents")
    op.drop_index(op.f("ix_hardware_documents_device_id"), table_name="hardware_documents")
    op.drop_table("hardware_documents")
