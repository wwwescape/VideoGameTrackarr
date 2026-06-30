def test_cors_allows_configured_dev_origin(client):
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unlisted_origin(client):
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert "access-control-allow-origin" not in {k.lower() for k in response.headers}
