BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "companies" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT,
	"igdb_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "games" (
	"id"	INTEGER,
	"igdb_id"	INTEGER,
	"name"	TEXT,
	"first_release_date"	INTEGER,
	"slug"	TEXT,
	"storyline"	TEXT,
	"summary"	TEXT,
	"igdb_url"	TEXT,
	"wishlisted"	INTEGER DEFAULT 0,
	"wishlisted_addons"	INTEGER DEFAULT 0,
	"owned"	INTEGER DEFAULT 0,
	"owned_addons"	INTEGER DEFAULT 0,
	"parent_game_id"	INTEGER,
	"is_dlc"	INTEGER DEFAULT 0,
	"is_expansion"	INTEGER DEFAULT 0,
	"is_pack"	INTEGER DEFAULT 0,
	"added_on"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "regions" (
	"id"	INTEGER,
	"name"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "platforms" (
	"id"	INTEGER,
	"igdb_id"	INTEGER,
	"name"	TEXT,
	"slug"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "game_status" (
	"id"	INTEGER,
	"game_id"	INTEGER,
	"platform_id"	INTEGER,
	"provider_id"	INTEGER,
	"region_id"	INTEGER,
	"edition"	TEXT,
	"format"	INTEGER,
	"status"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "migrations" (
	"id"	INTEGER,
	"name"	TEXT,
	"executed"	INTEGER,
	"executed_on"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
 COMMIT;
