import httpx
import pytest
import respx

from app.services.gog_client import (
    GOG_API_BASE,
    GOG_AUTH_BASE,
    GOG_EMBED_BASE,
    GOG_REDIRECT_URI,
    GOG_USERS_BASE,
    GogAuthError,
    GogClient,
    GogNotConnectedError,
    _parse_wishlist_ids,
    build_login_url,
)

_TOKENS = {"access_token": "access-1", "refresh_token": "refresh-2", "user_id": "4242", "expires_in": 3600}


def test_login_url_targets_the_galaxy_client_redirect():
    url = build_login_url()

    assert url.startswith(f"{GOG_AUTH_BASE}/auth?")
    assert f"redirect_uri={GOG_REDIRECT_URI}" in url
    assert "response_type=code" in url


@respx.mock
async def test_exchange_code_returns_tokens():
    route = respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=_TOKENS))

    tokens = await GogClient.exchange_code("the-code")

    assert tokens.refresh_token == "refresh-2"
    assert tokens.user_id == "4242"
    params = route.calls.last.request.url.params
    assert params["grant_type"] == "authorization_code"
    assert params["code"] == "the-code"


@respx.mock
async def test_exchange_code_turns_a_rejected_code_into_an_auth_error():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(400, json={"error": "invalid_grant"}))

    with pytest.raises(GogAuthError):
        await GogClient.exchange_code("expired")


@respx.mock
async def test_exchange_code_rejects_a_response_without_tokens():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json={"access_token": "only"}))

    with pytest.raises(GogAuthError):
        await GogClient.exchange_code("the-code")


async def test_an_authenticated_call_without_a_refresh_token_is_not_connected():
    async with GogClient() as client:
        with pytest.raises(GogNotConnectedError):
            await client.get_owned_library()


@respx.mock
async def test_owned_library_refreshes_once_rotates_the_token_and_walks_every_page():
    token_route = respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=_TOKENS))
    library_route = respx.get(f"{GOG_EMBED_BASE}/account/getFilteredProducts").mock(
        side_effect=[
            httpx.Response(200, json={"totalPages": 2, "products": [{"id": 1, "title": "Gwent"}]}),
            httpx.Response(200, json={"totalPages": 2, "products": [{"id": 2, "title": "Witcher 3"}]}),
        ]
    )

    async with GogClient(refresh_token="refresh-1") as client:
        games = await client.get_owned_library()

        assert [(game.product_id, game.name) for game in games] == [(1, "Gwent"), (2, "Witcher 3")]
        assert client.refresh_token == "refresh-2"
    assert token_route.call_count == 1
    assert token_route.calls.last.request.url.params["refresh_token"] == "refresh-1"
    assert library_route.calls[0].request.headers["Authorization"] == "Bearer access-1"
    assert library_route.calls[1].request.url.params["page"] == "2"


@respx.mock
async def test_a_revoked_refresh_token_is_an_auth_error():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(401))

    async with GogClient(refresh_token="revoked") as client:
        with pytest.raises(GogAuthError):
            await client.get_owned_library()


@respx.mock
async def test_get_username_uses_a_seeded_access_token_without_refreshing():
    token_route = respx.get(f"{GOG_AUTH_BASE}/token")
    respx.get(f"{GOG_USERS_BASE}/users/4242").mock(return_value=httpx.Response(200, json={"username": "geralt"}))

    async with GogClient(refresh_token="r", access_token="a", access_token_expires_at=9_999_999_999) as client:
        assert await client.get_username("4242") == "geralt"
    assert token_route.call_count == 0


@respx.mock
async def test_store_details_reads_title_box_art_and_a_plain_summary():
    respx.get(f"{GOG_API_BASE}/v2/games/1207664663").mock(
        return_value=httpx.Response(
            200,
            json={
                "_embedded": {"product": {"title": "The Witcher 3"}},
                "_links": {"boxArtImage": {"href": "https://images.gog-statics.com/box.jpg"}},
                "description": '<div><img src="x.png"></div><p>Become a <b>monster</b> slayer &amp; more.</p>',
            },
        )
    )

    async with GogClient() as client:
        details = await client.get_store_details(1207664663)

    assert details.name == "The Witcher 3"
    assert details.cover_url == "https://images.gog-statics.com/box.jpg"
    assert details.summary == "Become a monster slayer & more."


@respx.mock
async def test_store_details_for_a_missing_product_is_none():
    respx.get(f"{GOG_API_BASE}/v2/games/1").mock(return_value=httpx.Response(404))

    async with GogClient() as client:
        assert await client.get_store_details(1) is None


@respx.mock
async def test_wishlist_ids_read_the_documented_id_map():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=_TOKENS))
    route = respx.get(f"{GOG_EMBED_BASE}/user/wishlist.json").mock(
        return_value=httpx.Response(
            200, json={"wishlist": {"1207664663": True, "5": False, "7": True}, "checksum": "x"}
        )
    )

    async with GogClient(refresh_token="refresh-1") as client:
        assert await client.get_wishlist_ids() == [1207664663, 7]
    assert route.calls.last.request.headers["Authorization"] == "Bearer access-1"


@pytest.mark.parametrize(
    "payload",
    [
        {"wishlist": [1, 2, 2]},
        [1, 2],
        {"wishlist": [{"id": 1}, {"id": "2"}, {"title": "no id"}]},
        {"1": True, "2": True, "checksum": "abc"},
    ],
)
def test_wishlist_ids_tolerate_other_shapes(payload):
    assert _parse_wishlist_ids(payload) == [1, 2]


def test_wishlist_ids_of_an_unexpected_body_are_empty():
    assert _parse_wishlist_ids({"error": "nope"}) == []
    assert _parse_wishlist_ids(None) == []


@respx.mock
async def test_product_titles_come_from_the_public_batch_endpoint():
    route = respx.get(f"{GOG_API_BASE}/products").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "title": "One"}, {"id": 2, "title": "Two"}])
    )

    async with GogClient() as client:
        assert await client.get_product_titles([1, 2, 3]) == {1: "One", 2: "Two"}
    assert route.calls.last.request.url.params["ids"] == "1,2,3"
    assert "Authorization" not in route.calls.last.request.headers


async def test_product_titles_of_nothing_make_no_request():
    async with GogClient() as client:
        assert await client.get_product_titles([]) == {}


@respx.mock
async def test_product_downloads_parse_installers_and_skip_empty_ones():
    respx.get(f"{GOG_API_BASE}/products/1207664663").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 1207664663,
                "title": "The Witcher 3",
                "downloads": {
                    "installers": [
                        {
                            "id": "en1installer0",
                            "os": "windows",
                            "language": "en",
                            "version": "4.04",
                            "total_size": 3,
                            "files": [{"id": "en1installer0", "size": 3, "downlink": f"{GOG_API_BASE}/d/1"}],
                        },
                        {"id": "broken", "os": "linux", "files": []},
                    ]
                },
                "expanded_dlcs": [
                    {"id": 2, "title": "No installers", "downloads": {"installers": []}},
                    {
                        "id": 3,
                        "title": "DLC",
                        "downloads": {
                            "installers": [
                                {
                                    "id": "d",
                                    "os": "mac",
                                    "files": [{"id": "d", "size": 1, "downlink": f"{GOG_API_BASE}/d/2"}],
                                }
                            ]
                        },
                    },
                ],
            },
        )
    )

    async with GogClient(access_token="a", access_token_expires_at=9_999_999_999) as client:
        groups = await client.get_product_downloads(1207664663)

    assert [group.product_id for group in groups] == [1207664663, 3]
    [installer] = groups[0].installers
    assert (installer.os, installer.version, installer.files[0].downlink) == ("windows", "4.04", f"{GOG_API_BASE}/d/1")
    assert groups[1].installers[0].total_size == 1


@respx.mock
async def test_resolve_downlink_returns_the_cdn_address():
    respx.get(f"{GOG_API_BASE}/d/1").mock(
        return_value=httpx.Response(200, json={"downlink": "https://cdn.gog.com/x.exe"})
    )

    async with GogClient(access_token="a", access_token_expires_at=9_999_999_999) as client:
        assert await client.resolve_downlink(f"{GOG_API_BASE}/d/1") == "https://cdn.gog.com/x.exe"
