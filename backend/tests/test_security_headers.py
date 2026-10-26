from app.main import security_headers_for


def test_api_and_app_responses_carry_the_security_headers(client):
    response = client.get("/healthz")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    csp = response.headers["Content-Security-Policy"]
    assert "script-src 'self';" in csp
    assert "frame-ancestors 'self'" in csp
    assert "'unsafe-eval'" not in csp


def test_the_emulator_gets_its_own_policy():
    csp = security_headers_for("/emulatorjs/player.html")["Content-Security-Policy"]

    assert "'wasm-unsafe-eval'" in csp
    assert "worker-src 'self' blob:" in csp
    assert "frame-ancestors 'self'" in csp


def test_share_pages_send_no_referrer():
    assert security_headers_for("/public/abc/games")["Referrer-Policy"] == "no-referrer"
    assert security_headers_for("/api/public/abc/games")["Referrer-Policy"] == "no-referrer"
    assert security_headers_for("/games")["Referrer-Policy"] == "strict-origin-when-cross-origin"
