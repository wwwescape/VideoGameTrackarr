from app.services import job_registry, resync_jobs


def register_builtin_jobs() -> None:
    """Called once from app/main.py's lifespan, before the scheduler starts (so a persisted
    schedule referencing a job id can resolve it). Adding a future job is exactly one more
    import + register() call here. Registration order drives job_registry.list_jobs()'s
    order, which drives the Jobs UI list order — broadest scope first."""
    job_registry.register(resync_jobs.DEFINITION_ALL)
    job_registry.register(resync_jobs.DEFINITION_GAMES)
    job_registry.register(resync_jobs.DEFINITION_COLLECTIONS)
    job_registry.register(resync_jobs.DEFINITION_SERIES)
