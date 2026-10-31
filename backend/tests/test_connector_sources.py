import json

import pytest

from app.services import nintendo_titledb
from app.services.store_clients import code_from_paste


@pytest.mark.parametrize(
    ("pasted", "expected"),
    [
        ("abc123", "abc123"),
        ('{"redirectUrl": "x", "authorizationCode": "abc123", "sid": null}', "abc123"),
        ("https://embed.gog.com/on_login_success?origin=client&code=abc123", "abc123"),
    ],
)
def test_a_store_sign_in_accepts_the_code_its_json_or_its_url(pasted, expected):
    assert code_from_paste(pasted, "authorizationCode" if pasted.startswith("{") else "code") == expected


def test_the_nintendo_title_index_is_read_entry_by_entry(tmp_path, monkeypatch):
    region = tmp_path / "GB.en.json"
    entries = {
        "70010000000001": {"id": "01004EA00DF70000", "name": "PICO PARK™", "numberOfPlayers": 8},
        "70010000000002": {"id": "01004EA00DF70800", "name": "PICO PARK update", "numberOfPlayers": None},
        "70010000000003": {"id": "0100EA6014BB8000", "name": "Just Dance® 2022", "numberOfPlayers": "6"},
    }
    region.write_text(json.dumps(entries, indent=2))
    monkeypatch.setattr(nintendo_titledb, "_CHUNK_SIZE", 64)

    assert len(list(nintendo_titledb.iter_entries(region))) == 3
    index = nintendo_titledb.build_index([region])
    assert index == {
        "01004EA00DF70000": {"name": "PICO PARK", "players": 8},
        "0100EA6014BB8000": {"name": "Just Dance 2022", "players": 6},
    }

    monkeypatch.setattr(nintendo_titledb, "load_index", lambda: index)
    assert nintendo_titledb.get_title("01004ea00df70800") == nintendo_titledb.NintendoTitle("PICO PARK", 8)
