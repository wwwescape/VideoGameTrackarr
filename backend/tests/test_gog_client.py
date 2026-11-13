import httpx
import pytest
import respx

from app.services.gog_client import (
    GOG_API_BASE,
    GOG_AUTH_BASE,
    GOG_EMBED_BASE,
    GOG_USERS_BASE,
    GogAuthError,
    GogClient,
    GogNotConfiguredError,
)

TOKEN_PAYLOAD = {
    "access_token": "access-1",
    "expires_in": 3600,
    "token_type": "Bearer",
    "refresh_token": "refresh-1",
    "user_id": "424242",
    "session_id": "session-1",
}


def make_client(**overrides):
    return GogClient(refresh_token="refresh-0", **overrides)


@respx.mock
async def test_exchange_code_returns_tokens_and_user_id():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))

    tokens = await GogClient.exchange_code("auth-code-123")

    assert tokens.access_token == "access-1"
    assert tokens.refresh_token == "refresh-1"
    assert tokens.user_id == "424242"
    assert tokens.expires_in == 3600


@respx.mock
async def test_exchange_code_rejects_a_bad_code_without_retrying():
    route = respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(400, json={"error": "invalid_grant"}))

    with pytest.raises(GogAuthError):
        await GogClient.exchange_code("bad-code")

    assert route.call_count == 1


@respx.mock
async def test_get_owned_library_pages_and_refreshes_once():
    token_route = respx.get(f"{GOG_AUTH_BASE}/token").mock(
        return_value=httpx.Response(
            200,
            json={**TOKEN_PAYLOAD, "access_token": "access-2", "refresh_token": "refresh-2"},
        )
    )
    library_route = respx.get(f"{GOG_EMBED_BASE}/account/getFilteredProducts").mock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "totalPages": 2,
                    "products": [{"id": 1207658695, "title": "The Witcher 3"}],
                },
            ),
            httpx.Response(
                200,
                json={
                    "totalPages": 2,
                    "products": [{"id": 1207658885, "title": "Cyberpunk 2077"}],
                },
            ),
        ]
    )

    client = make_client()
    games = await client.get_owned_library()

    assert token_route.call_count == 1
    assert library_route.call_count == 2
    assert [(g.product_id, g.name) for g in games] == [
        (1207658695, "The Witcher 3"),
        (1207658885, "Cyberpunk 2077"),
    ]
    # The refresh token rotated — the caller persists this back to the user row.
    assert client.refresh_token == "refresh-2"


@respx.mock
async def test_get_owned_library_reuses_a_valid_access_token():
    token_route = respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_EMBED_BASE}/account/getFilteredProducts").mock(
        return_value=httpx.Response(
            200, json={"totalPages": 1, "products": [{"id": 1207658695, "title": "The Witcher 3"}]}
        )
    )

    client = GogClient(
        refresh_token="refresh-1", access_token="access-1", access_token_expires_at=9999999999
    )
    games = await client.get_owned_library()

    assert token_route.call_count == 0
    assert [g.product_id for g in games] == [1207658695]


async def test_authenticated_calls_without_a_token_raise_not_configured():
    client = GogClient(refresh_token=None)

    with pytest.raises(GogNotConfiguredError):
        await client.get_owned_library()


@respx.mock
async def test_revoked_token_raises_auth_error_without_retrying():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    library_route = respx.get(f"{GOG_EMBED_BASE}/account/getFilteredProducts").mock(
        return_value=httpx.Response(401, json={"error": "unauthorized"})
    )

    with pytest.raises(GogAuthError):
        await make_client().get_owned_library()

    assert library_route.call_count == 1


@respx.mock
async def test_get_username_returns_the_display_name():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_USERS_BASE}/users/424242").mock(
        return_value=httpx.Response(200, json={"username": "Flyingfox"})
    )

    username = await make_client().get_username("424242")

    assert username == "Flyingfox"


@respx.mock
async def test_get_product_downloads_parses_installers_and_dlc_groups():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_API_BASE}/products/1207658695").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 1207658695,
                "title": "The Witcher 3",
                "downloads": {
                    "installers": [
                        {
                            "id": "installer_windows_en",
                            "os": "windows",
                            "language": "en",
                            "version": "1.32",
                            "total_size": 123456789,
                            "files": [
                                {
                                    "id": "en1installer0",
                                    "size": 123456789,
                                    "downlink": f"{GOG_API_BASE}/products/1207658695/downlink/installer/en1installer0",
                                }
                            ],
                        },
                        {
                            # No files — nothing downloadable, skipped.
                            "id": "installer_linux_en",
                            "os": "linux",
                            "language": "en",
                            "version": "1.32",
                            "total_size": 0,
                            "files": [],
                        },
                    ],
                    "patches": [],
                    "language_packs": [],
                },
                "expanded_dlcs": [
                    {
                        "id": 1234567890,
                        "title": "Hearts of Stone",
                        "downloads": {
                            "installers": [
                                {
                                    "id": "installer_windows_en",
                                    "os": "windows",
                                    "language": "en",
                                    "version": "1.0",
                                    "total_size": 987654,
                                    "files": [
                                        {
                                            "id": "en1installer0",
                                            "size": 987654,
                                            "downlink": (
                                                f"{GOG_API_BASE}/products/1234567890"
                                                "/downlink/installer/en1installer0"
                                            ),
                                        }
                                    ],
                                }
                            ]
                        },
                    },
                    {
                        # A DLC with no installers at all — its group is dropped.
                        "id": 1234567891,
                        "title": "Soundtrack",
                        "downloads": {"installers": []},
                    },
                ],
            },
        )
    )

    groups = await make_client().get_product_downloads(1207658695)

    assert [(g.product_id, g.title) for g in groups] == [
        (1207658695, "The Witcher 3"),
        (1234567890, "Hearts of Stone"),
    ]
    [base_installer] = groups[0].installers
    assert base_installer.os == "windows"
    assert base_installer.language == "en"
    assert base_installer.version == "1.32"
    assert base_installer.total_size == 123456789
    assert [f.id for f in base_installer.files] == ["en1installer0"]
    [dlc_installer] = groups[1].installers
    assert [f.id for f in dlc_installer.files] == ["en1installer0"]


@respx.mock
async def test_resolve_downlink_returns_the_cdn_url():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_API_BASE}/products/1207658695/downlink/installer/en1installer0").mock(
        return_value=httpx.Response(200, json={"downlink": "https://cdn.gog.com/setup_witcher3.exe"})
    )

    url = await make_client().resolve_downlink(
        f"{GOG_API_BASE}/products/1207658695/downlink/installer/en1installer0"
    )

    assert url == "https://cdn.gog.com/setup_witcher3.exe"
