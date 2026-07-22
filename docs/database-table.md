# Database tables

Companion to [developer-guide.md](developer-guide.md) and [diagrams.md](diagrams.md). Every
table below is a SQLAlchemy model in `backend/app/models/` (`catalog.py`, `hardware.py`,
`library.py`, `system.py`) — schema changes always go through an Alembic migration in
`backend/alembic/versions/`, never a hand edit to the running DB.

**Conventions used throughout:**
- Every table listed as having `created_at`/`updated_at` gets them from `TimestampMixin`
  (`app/models/mixins.py`) — both `DateTime(timezone=True)`, server-defaulted to `now()`,
  `updated_at` also `onupdate`s to `now()`. Pure link/junction tables (composite PK of two
  FKs) deliberately skip this mixin.
- Enum columns (`enum_column()` in `mixins.py`) store the enum's lowercase `.value` as text
  with a real `CHECK` constraint — not SQLite's native enum type.
- `devices`/`accessories` both have a `uuid` (public identifier, used in URLs as
  `{slug}-{uuid}`) separate from their internal integer `id`. Same pattern on `games`.
- This app is single-admin, not multi-tenant — catalog/library tables are **not** scoped by
  `user_id` (see `users` below).

---

## Catalog (`catalog.py`) — IGDB-sourced game data

The master game catalog, synced from IGDB. Distinct from `library_items` (library.py), which
tracks the user's own copies of these games.

### `games`

One row per game (IGDB-sourced or manually added).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| uuid | string(36), unique | Public identifier |
| igdb_id | bigint, unique | NULL for manually-added games |
| name | string(512) | |
| slug | string(512), unique | Public lookup key `/api/games/{slug}` for IGDB-sourced games; NULL for manual ones (which use `{name-slug}-{uuid}` instead) |
| summary, storyline | text | |
| edition | string(255) | Free text, manually-added games only |
| igdb_url | string(1024) | |
| first_release_date | bigint | Unix timestamp, from IGDB |
| cover_url | string(1024) | |
| category | enum `GameCategory` | `main_game`, `dlc_addon`, `expansion`, `bundle`, `standalone_expansion`, `mod`, `episode`, `season`, `remake`, `remaster`, `expanded_game`, `port`, `fork`, `pack`, `update` — order is load-bearing, mirrors IGDB's numeric `category` field |
| igdb_category_id | int | Raw IGDB numeric category, cached |
| parent_game_id | FK → games.id | Hierarchical parent (DLC/expansion nested under a copy) |
| display_parent_game_id | FK → games.id | Non-hierarchical "shown as related to" link (e.g. an independently-owned standalone expansion) |
| external_parent_name, external_parent_igdb_url | string | Fallback display data when the conceptual parent was never imported locally |
| similar_game_igdb_ids | JSON | Cached IGDB `similar_games`, powers recommendations |
| created_at, updated_at | timestamp | |

### `platforms`

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| igdb_id | bigint, unique | |
| name | string(255) | |
| slug | string(255) | |
| abbreviation | string(50) | |
| logo_url | string(1024) | |
| created_at, updated_at | timestamp | |

### `regions`

Physical/digital media region (PAL, NTSC-U, NTSC-J) — a collection-tracking concept, not
something IGDB models.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| name | string(100), unique | |
| created_at, updated_at | timestamp | |

### `genres`

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| igdb_id | bigint, unique | |
| name | string(255) | |
| slug | string(255) | |
| created_at, updated_at | timestamp | |

### `companies`

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| igdb_id | bigint, unique | |
| name | string(255) | |
| slug | string(255) | |
| logo_url | string(1024) | |
| created_at, updated_at | timestamp | |

### `collections`

IGDB "collection" — a game series.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| igdb_id | bigint, unique | |
| name | string(255) | |
| slug | string(255), unique | Public lookup key `/api/collections/{slug}` |
| created_at, updated_at | timestamp | |

### `franchises`

Same shape as `collections` (`igdb_id`, `name`, `slug` unique for `/api/franchises/{slug}`,
timestamps).

### `game_genres`, `game_platforms`, `game_companies`, `game_franchises`, `game_collections`

Many-to-many junction tables, composite PK, no timestamps:

| Table | PK columns | Extra |
|---|---|---|
| game_genres | game_id, genre_id | |
| game_platforms | game_id, platform_id | Which platforms a game *was released on* (IGDB) — distinct from `library_items.platform_id`, which platform *the user's copy* is on |
| game_companies | game_id, company_id, role | `role` is enum `CompanyRole`: `developer`, `publisher`, `porting`, `supporting` |
| game_franchises | game_id, franchise_id | |
| game_collections | game_id, collection_id | Many-to-many since IGDB's own API allows a game in more than one collection |

### `screenshots`, `game_videos`, `artworks`

One row per media asset, all shaped the same way:

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id | |
| igdb_id | bigint, unique | |
| url (screenshots/artworks) / video_id (game_videos) | string(1024) / string(255) | `game_videos.video_id` is a YouTube id; `game_videos.name` is optional |

### `release_dates`

Per-platform, per-IGDB-region release date. A game can have multiple rows for the same
platform+region (e.g. a re-release under a different IGDB id).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id | |
| platform_id | FK → platforms.id, nullable | |
| release_region | enum `IgdbReleaseRegion`, nullable | `europe`, `north_america`, `australia`, `new_zealand`, `japan`, `china`, `asia`, `worldwide` — IGDB's geographic enum, distinct from the media-region `regions` table above |
| igdb_id | bigint, unique | The real natural key (not the platform+region combo) |
| date | bigint | Unix timestamp |
| human | string(100) | IGDB's human-readable date string |

---

## Library (`library.py`) — the user's own collection & progress

### `library_items`

One row per copy the user owns or wants (mirrors `user_devices`/`user_accessories` for
hardware).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id | |
| platform_id | FK → platforms.id, nullable | |
| region_id | FK → regions.id, nullable | |
| status | enum `LibraryStatus` | `owned`, `wishlist` |
| format | enum `MediaFormat`, nullable | `physical`, `digital`, `iso`, `rom`, `abandonware`, `other` |
| digital_storefront | string(100) | e.g. Steam, PSN, Epic — only meaningful when `format=digital` |
| rating_board | enum `RatingBoard`, nullable | `esrb`, `pegi`, `cero`, `usk`, `grac`, `classind`, `acb`, `iarc` |
| edition | string(255) | Free text |
| price | float | |
| acquired_at | date | |
| notes | text | |
| created_at, updated_at | timestamp | |

### `game_progress`

One row per game (unique `game_id`): play status, playtime, personal rating/review.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id, unique | |
| play_status | enum `PlayStatus` | `none`, `backlog`, `playing`, `completed`, `abandoned` |
| playtime_minutes | int | Default 0 |
| rating | float, nullable | |
| review | text | |
| started_at, completed_at, last_played_at | date | |
| created_at, updated_at | timestamp | |

### `play_sessions`

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id | |
| started_at | datetime(tz) | |
| ended_at | datetime(tz), nullable | |
| duration_minutes | int, nullable | |
| notes | text | |

No timestamp mixin (it *is* the timestamp data).

### `notes`

Free-text notes attached to a game (mirrors `device_notes`/`accessory_notes`).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| game_id | FK → games.id | |
| body | text | |
| created_at, updated_at | timestamp | |

### `tags`

Shared vocabulary across games/devices/accessories.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| name | string(100), unique | |
| color | string(20) | Hex color for UI chips |

### `game_tags`

Junction table: `game_id`, `tag_id` (composite PK). Mirrors `device_tags`/`accessory_tags`.

---

## Hardware (`hardware.py`) — devices, accessories, and their reference catalog

### Lookup tables

Small `id`/`name` (unique) vocab tables, each with timestamps, no other columns:
`manufacturers`, `hardware_platforms` (e.g. "PlayStation 5", "Xbox Series" — distinct from
`platforms` above, which is IGDB's per-game vocabulary), `device_types`, `accessory_types`,
`storage_variants`, `colors`.

### `hardware_reference_entries`

Curated reference data (one row per real-world hardware SKU across
Nintendo/Sony/Xbox/PlayStation) — powers the Brand/Console/Variant cascade on Add Device/Add
Accessory (Predefined) and the "rich" descriptive data on detail pages. Not something a user
owns directly — `devices`/`accessories` link to this via `hardware_reference_entry_id`.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| brand | string(100) | e.g. "Sony" |
| family | string(100), nullable | e.g. "PlayStation" |
| generation | string(100) | e.g. "PlayStation 5" |
| generation_short | string(50), nullable | Abbreviated form, e.g. "PS5" — kept deliberately short even where `official_name`/`artefact` spell it out in full |
| artefact | string(255) | e.g. "PlayStation 5 Pro" |
| official_name | string(255), unique | e.g. "Sony PlayStation 5 Pro" — the display name, and the string curated product images are resolved from (see `app/services/hardware_reference_image_service.py`, `docs/hardware-reference.md`) |
| category | string(100) | e.g. "Console", "Controller" |
| type | string(20) | `Device` or `Accessory` |
| release_date | string(20), nullable | Free text but always normalized to a 4-digit year at import |
| discontinued | bool | |
| compatibility | string(255), nullable | |
| summary | text, nullable | |
| created_at, updated_at | timestamp | |

Note: no `image_url` column here — curated images are resolved at read time from
`official_name`, not stored (see the linked service above).

### `devices`

Master catalog row for one physical device SKU (e.g. "Xbox Series X") — not an owned copy,
see `user_devices` for that.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| uuid | string(36), unique | |
| manufacturer_id | FK → manufacturers.id | |
| hardware_platform_id | FK → hardware_platforms.id, nullable | |
| device_type_id | FK → device_types.id | |
| official_name | string(255) | |
| model | string(255), nullable | |
| revision | string(100), nullable | |
| storage_variant_id | FK → storage_variants.id, nullable | |
| color_id | FK → colors.id, nullable | |
| rating_board | enum `RatingBoard`, nullable | |
| hardware_reference_entry_id | FK → hardware_reference_entries.id, nullable | NULL for rows that predate the reference-entry cascade (or the table itself) — see the backfill migrations in `alembic/versions/` |
| external_source, external_id | string(100), nullable | Sync hook for future catalog sources; unique together |
| created_at, updated_at | timestamp | |

No `image_url` column — there's no custom-device creation mode in the app (every Device comes
from the predefined cascade), so a device's image is always resolved via its linked
`hardware_reference_entry`.

### `device_tags`, `device_notes`

- `device_tags`: junction, `device_id` + `tag_id` composite PK.
- `device_notes`: `id` PK, `device_id` FK, `body` text, timestamps.

### `accessories`

Master catalog row for one accessory SKU (e.g. "DualSense"). Compatibility with hardware
platforms is many-to-many (see `accessory_compatibility`), separate from linking to specific
`devices` rows (see `accessory_device_links`).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| uuid | string(36), unique | |
| manufacturer_id | FK → manufacturers.id | |
| accessory_type_id | FK → accessory_types.id | |
| official_name | string(255) | |
| model | string(255), nullable | |
| revision | string(100), nullable | |
| edition | string(255), nullable | Free text, e.g. "Spider-Man 2 Limited Edition" |
| release_date | int, nullable | Year only — Custom Accessory only ever collects a year |
| color_id | FK → colors.id, nullable | |
| rating_board | enum `RatingBoard`, nullable | |
| hardware_reference_entry_id | FK → hardware_reference_entries.id, nullable | |
| summary | text, nullable | Free text, only ever set by the Custom Add Accessory form — predefined accessories show `hardware_reference_entry.summary` instead |
| image_url | string(1024), nullable | User-uploaded image — **only** meaningful for custom (non-reference-linked) accessories; predefined ones resolve their image from the linked reference entry instead, which wins only if this is unset |
| external_source, external_id | string(100), nullable | Unique together |
| created_at, updated_at | timestamp | |

### `accessory_compatibility`, `accessory_device_links`, `accessory_accessory_links`

Junction tables, composite PK, no timestamps:

| Table | PK columns | Purpose |
|---|---|---|
| accessory_compatibility | accessory_id, hardware_platform_id | Broad platform compatibility (e.g. "works with PS5 generally") |
| accessory_device_links | accessory_id, device_id | Ties an accessory to a *specific* device row (e.g. this exact DualSense linked to this exact PS5 Slim) |
| accessory_accessory_links | accessory_id, linked_accessory_id | Self-referential (e.g. a protection case linked to the controller it fits); both FKs point at `accessories.id` |

### `accessory_tags`, `accessory_notes`

Same shape as `device_tags`/`device_notes` above, scoped to `accessory_id`.

### `user_devices`, `user_accessories`

One row per owned/wishlisted copy — mirrors `library_items`'s role for games. A second copy
is always a separate row (identified by its own `serial_number`).

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| device_id / accessory_id | FK | |
| status | enum `LibraryStatus` | `owned`, `wishlist` |
| condition | enum `HardwareCondition`, nullable | `sealed`, `new`, `like_new`, `good`, `fair`, `poor` |
| purchase_price | float, nullable | |
| serial_number | string(255), nullable | |
| notes | text, nullable | |
| created_at, updated_at | timestamp | |

---

## System (`system.py`) — auth

### `users`

Single admin account gatekeeping this instance — **not** multi-tenant. No other table is
scoped by `user_id`.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| username | string(255), unique | |
| password_hash | string(255) | |
| created_at, updated_at | timestamp | |

### `refresh_tokens`

Server-side record of issued refresh tokens so they can be revoked before natural expiry
(logout, password change). Access tokens are short-lived and stateless and never get a table.

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| user_id | FK → users.id | |
| jti | string(36), unique | |
| expires_at | datetime(tz) | |
| revoked_at | datetime(tz), nullable | |
| created_at | datetime(tz) | Server-defaulted, no `updated_at` (rows are never updated, only revoked/expired) |
