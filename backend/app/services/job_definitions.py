from app.services import (
    connector_pull_jobs,
    event_sync_jobs,
    igdb_import_jobs,
    itad_jobs,
    job_registry,
    nintendo_titledb_jobs,
    platprices_jobs,
    players_fill_jobs,
    resync_jobs,
    steam_jobs,
)


def register_builtin_jobs() -> None:
    """Called once from app/main.py's lifespan, before the scheduler starts (so a persisted
    schedule referencing a job id can resolve it). Adding a future job is exactly one more
    import + register() call here. Registration order drives job_registry.list_jobs()'s
    order, which drives the Jobs UI list order — Events Sync pinned first per explicit
    product choice, then the resync jobs broadest-scope-first, then the rest."""
    job_registry.register(event_sync_jobs.DEFINITION_EVENTS_SYNC)
    job_registry.register(resync_jobs.DEFINITION_ALL)
    job_registry.register(resync_jobs.DEFINITION_GAMES)
    job_registry.register(resync_jobs.DEFINITION_COLLECTIONS)
    job_registry.register(resync_jobs.DEFINITION_SERIES)
    job_registry.register(players_fill_jobs.DEFINITION_PLAYERS_FILL)
    job_registry.register(igdb_import_jobs.DEFINITION_IGDB_MATCH)
    job_registry.register(igdb_import_jobs.DEFINITION_IGDB_LINK)
    job_registry.register(steam_jobs.DEFINITION_STEAM_IMPORT)
    job_registry.register(connector_pull_jobs.DEFINITION_CONNECTORS_PULL)
    job_registry.register(itad_jobs.DEFINITION_ITAD_REFRESH)
    job_registry.register(platprices_jobs.DEFINITION_PLATPRICES_REFRESH)
    job_registry.register(nintendo_titledb_jobs.DEFINITION_NINTENDO_TITLEDB)
