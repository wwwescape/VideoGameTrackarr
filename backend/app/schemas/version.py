from app.schemas.base import CamelModel


class WhatsNewRelease(CamelModel):
    version: str
    name: str
    # The release notes, as GitHub Markdown.
    body: str
    url: str
    published_at: str | None


class WhatsNewResponse(CamelModel):
    current_version: str
    # Newest first; empty when there's nothing new to show.
    releases: list[WhatsNewRelease]
    # GitHub couldn't be reached: show a link to the running version's release instead.
    notes_unavailable: bool
    release_url: str


class VersionResponse(CamelModel):
    current_version: str
    latest_version: str | None
    update_available: bool
    release_url: str | None
