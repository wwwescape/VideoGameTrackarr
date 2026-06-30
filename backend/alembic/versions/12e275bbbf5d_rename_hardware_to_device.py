"""rename hardware to device

Revision ID: 12e275bbbf5d
Revises: fcde87082b21
Create Date: 2026-06-27 15:31:16.347315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '12e275bbbf5d'
down_revision: Union[str, None] = 'fcde87082b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pure renames — SQLite 3.25+ supports ALTER TABLE RENAME TO / RENAME COLUMN natively, no
    # batch mode needed. hardware_platforms/hardware_platform_id stay untouched: HardwarePlatform
    # is shared by both Device and Accessory, and renaming it to "Platform" would collide with
    # the unrelated, pre-existing catalog.Platform (IGDB game platforms).
    op.rename_table("hardware", "devices")
    op.rename_table("hardware_types", "device_types")
    op.rename_table("hardware_editions", "device_editions")
    op.rename_table("user_hardware", "user_devices")
    op.rename_table("accessory_hardware_links", "accessory_device_links")

    op.alter_column("devices", "hardware_type_id", new_column_name="device_type_id")
    op.alter_column("device_editions", "hardware_id", new_column_name="device_id")
    op.alter_column("user_devices", "hardware_id", new_column_name="device_id")
    op.alter_column("user_devices", "hardware_edition_id", new_column_name="device_edition_id")
    op.alter_column("accessory_device_links", "hardware_id", new_column_name="device_id")


def downgrade() -> None:
    op.alter_column("accessory_device_links", "device_id", new_column_name="hardware_id")
    op.alter_column("user_devices", "device_edition_id", new_column_name="hardware_edition_id")
    op.alter_column("user_devices", "device_id", new_column_name="hardware_id")
    op.alter_column("device_editions", "device_id", new_column_name="hardware_id")
    op.alter_column("devices", "device_type_id", new_column_name="hardware_type_id")

    op.rename_table("accessory_device_links", "accessory_hardware_links")
    op.rename_table("user_devices", "user_hardware")
    op.rename_table("device_editions", "hardware_editions")
    op.rename_table("device_types", "hardware_types")
    op.rename_table("devices", "hardware")
