from app.models.events import Event, EventGame, EventNetwork, EventVideo


def _seed_event(db_session, **overrides) -> Event:
    defaults = dict(igdb_id=1, name="Gamescom 2026", slug="gamescom-2026", start_time=2000000000, end_time=2000100000)
    defaults.update(overrides)
    event = Event(**defaults)
    db_session.add(event)
    db_session.commit()
    return event


def test_list_events_requires_auth(client):
    response = client.get("/api/events")

    assert response.status_code == 401


def test_list_events_returns_upcoming_soonest_first(auth_client, db_session):
    _seed_event(db_session, igdb_id=1, slug="soonest", name="Soonest", start_time=100, end_time=9999999999)
    _seed_event(db_session, igdb_id=2, slug="later", name="Later", start_time=200, end_time=9999999999)

    response = auth_client.get("/api/events")

    assert response.status_code == 200
    names = [e["name"] for e in response.json()]
    assert names == ["Soonest", "Later"]


def test_list_events_excludes_ended_events(auth_client, db_session):
    _seed_event(db_session, igdb_id=1, slug="ended", name="Ended", end_time=1)  # long past

    response = auth_client.get("/api/events")

    assert response.json() == []


def test_get_event_requires_auth(client):
    response = client.get("/api/events/does-not-exist")

    assert response.status_code == 401


def test_get_event_404_for_missing(auth_client):
    response = auth_client.get("/api/events/does-not-exist")

    assert response.status_code == 404


def test_get_event_returns_detail_with_videos_networks_and_games(auth_client, db_session, seed_game):
    event = _seed_event(db_session)
    db_session.add(EventVideo(event_id=event.id, igdb_id=10, name="Trailer", video_id="abc123"))
    db_session.add(EventNetwork(event_id=event.id, igdb_id=20, network_type="Twitter", url="https://x.com/e"))
    # One game that resolves locally (matches seed_game's igdb_id), one that doesn't.
    db_session.add(
        EventGame(event_id=event.id, igdb_game_id=seed_game.igdb_id, game_id=seed_game.id, name=seed_game.name)
    )
    db_session.add(EventGame(event_id=event.id, igdb_game_id=99999, name="Unknown Game"))
    db_session.commit()

    response = auth_client.get(f"/api/events/{event.slug}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Gamescom 2026"
    [video] = body["videos"]
    assert video["videoId"] == "abc123"
    [network] = body["networks"]
    assert network["networkType"] == "Twitter"
    games_by_igdb_id = {g["igdbGameId"]: g for g in body["games"]}
    assert games_by_igdb_id[seed_game.igdb_id]["gameId"] == seed_game.id
    assert games_by_igdb_id[seed_game.igdb_id]["gameSlug"] == seed_game.slug
    assert games_by_igdb_id[99999]["gameId"] is None


def test_resync_event_requires_auth(client):
    response = client.post("/api/events/1/resync")

    assert response.status_code == 401


def test_resync_event_404_for_missing(auth_client, igdb_client):
    response = auth_client.post("/api/events/999/resync")

    assert response.status_code == 404


def test_resync_event_updates_from_fresh_igdb_payload(auth_client, db_session, igdb_client, monkeypatch):
    event = _seed_event(db_session, name="Old Name")

    async def fake_get_event_by_igdb_id(self, igdb_id):
        assert igdb_id == event.igdb_id
        return {
            "id": event.igdb_id,
            "name": "New Name",
            "slug": "gamescom-2026",
            "start_time": 2000000000,
            "end_time": 2000100000,
        }

    monkeypatch.setattr(type(igdb_client), "get_event_by_igdb_id", fake_get_event_by_igdb_id)

    response = auth_client.post(f"/api/events/{event.id}/resync")

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_resync_event_404s_when_igdb_no_longer_has_it(auth_client, db_session, igdb_client, monkeypatch):
    event = _seed_event(db_session)

    async def fake_get_event_by_igdb_id(self, igdb_id):
        return None

    monkeypatch.setattr(type(igdb_client), "get_event_by_igdb_id", fake_get_event_by_igdb_id)

    response = auth_client.post(f"/api/events/{event.id}/resync")

    assert response.status_code == 404
