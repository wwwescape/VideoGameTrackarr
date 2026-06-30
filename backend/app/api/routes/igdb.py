import re
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_igdb_client
from app.schemas.game import IGDBParentGameResponse, IGDBSearchResultResponse
from app.services.game_service import resolve_igdb_category
from app.services.igdb_client import IGDBClient

router = APIRouter(prefix="/api/igdb", tags=["igdb"], dependencies=[Depends(get_current_user)])

# Lets users paste an exact IGDB id (e.g. "igdb:3542") instead of a name search — handy
# when a name search is ambiguous or too noisy to find a specific entry.
_IGDB_ID_QUERY_PATTERN = re.compile(r"^igdb:(\d+)$", re.IGNORECASE)


def _to_search_result(result: dict) -> IGDBSearchResultResponse:
    parent_ref = result.get("parent_game")
    parent_game = (
        IGDBParentGameResponse(igdb_id=parent_ref["id"], name=parent_ref.get("name") or f"IGDB #{parent_ref['id']}")
        if isinstance(parent_ref, dict) and parent_ref.get("id") is not None
        else None
    )
    return IGDBSearchResultResponse(
        igdb_id=result["id"],
        name=result.get("name"),
        slug=result.get("slug"),
        summary=result.get("summary"),
        cover_url=result.get("cover_url"),
        category=resolve_igdb_category(result)[1],
        first_release_date=result.get("first_release_date"),
        parent_game=parent_game,
    )


@router.get("/search", response_model=list[IGDBSearchResultResponse])
async def search_igdb(
    query: str = Query(min_length=1),
    category_scope: Literal["game", "addon"] = Query(default="game", alias="categoryScope"),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> list[IGDBSearchResultResponse]:
    id_match = _IGDB_ID_QUERY_PATTERN.match(query.strip())
    if id_match:
        results = await igdb_client.get_games_by_ids([int(id_match.group(1))])
    else:
        results = await igdb_client.search_games(query, category_scope=category_scope)
    return [_to_search_result(result) for result in results]
