"""seed nintendo switch 2 hardware reference entries

Revision ID: 07b6adcc2380
Revises: 56b03c3c66b8
Create Date: 2026-07-21 12:23:19.013436

Nintendo Switch 2 launched (2025) after the curated dataset baked into 56b03c3c66b8 was
generated, so the console and its launch accessories are missing from
hardware_reference_entries. This leaves it out of the Brand/Console/Variant cascade on
Add Device/Add Accessory. Same `INSERT OR IGNORE` approach keyed off the unique
`official_name` index so it's safe to re-run against a DB that already has these rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json as _json


# revision identifiers, used by Alembic.
revision: str = "07b6adcc2380"
down_revision: Union[str, None] = "56b03c3c66b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ENTRIES_JSON = r'''[{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Nintendo Switch 2","official_name":"Nintendo Switch 2","category":"Console","type":"Device","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Nintendo Switch 2 is an official Nintendo gaming system that introduced new hardware capabilities and a library of first-party and third-party titles. It remains an important part of Nintendo's gaming history."},{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Joy-Con 2 (L)","official_name":"Nintendo Joy-Con 2 (Left)","category":"Controller","type":"Accessory","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Joy-Con 2 (L) is an official Nintendo accessory designed to provide left-hand controls. It extends the functionality of compatible Nintendo hardware while integrating seamlessly with the Nintendo ecosystem."},{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Joy-Con 2 (R)","official_name":"Nintendo Joy-Con 2 (Right)","category":"Controller","type":"Accessory","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Joy-Con 2 (R) is an official Nintendo accessory designed to provide right-hand controls. It extends the functionality of compatible Nintendo hardware while integrating seamlessly with the Nintendo ecosystem."},{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Joy-Con 2 Charging Grip","official_name":"Nintendo Joy-Con 2 Charging Grip","category":"Charging","type":"Accessory","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Joy-Con 2 Charging Grip is an official Nintendo accessory designed to charge Joy-Con 2 controllers while playing. It extends the functionality of compatible Nintendo hardware while integrating seamlessly with the Nintendo ecosystem."},{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Nintendo Switch 2 Pro Controller","official_name":"Nintendo Switch 2 Pro Controller","category":"Controller","type":"Accessory","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Nintendo Switch 2 Pro Controller is an official Nintendo accessory designed to provide premium wireless gameplay. It extends the functionality of compatible Nintendo hardware while integrating seamlessly with the Nintendo ecosystem."},{"brand":"Nintendo","family":"Nintendo","generation":"Nintendo Switch 2","generation_short":null,"artefact":"Nintendo Switch 2 Camera","official_name":"Nintendo Switch 2 Camera","category":"Camera","type":"Accessory","release_date":"2025","discontinued":0,"compatibility":"Nintendo Switch 2","summary":"The Nintendo Switch 2 Camera is an official Nintendo accessory designed to enable GameChat video calls. It extends the functionality of compatible Nintendo hardware while integrating seamlessly with the Nintendo ecosystem."}]'''


def upgrade() -> None:
    bind = op.get_bind()
    entries = _json.loads(_ENTRIES_JSON)
    bind.execute(
        sa.text(
            "INSERT OR IGNORE INTO hardware_reference_entries "
            "(brand, family, generation, generation_short, artefact, official_name, "
            "category, type, release_date, discontinued, compatibility, summary) "
            "VALUES (:brand, :family, :generation, :generation_short, :artefact, :official_name, "
            ":category, :type, :release_date, :discontinued, :compatibility, :summary)"
        ),
        entries,
    )


def downgrade() -> None:
    # Not reversed — Device/Accessory rows may already reference these entries by FK.
    pass
