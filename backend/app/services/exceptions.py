class NotFoundError(Exception):
    """Raised by services when a requested entity doesn't exist; routes translate this to 404."""


class ConflictError(Exception):
    """Raised by services when a request conflicts with existing state (e.g. linking to an
    IGDB id another local game already uses); routes translate this to 409."""
