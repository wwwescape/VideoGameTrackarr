from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import session_scope
from app.models import Base


@pytest.fixture()
def spied_session(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'session_scope.db').as_posix()}")
    Base.metadata.create_all(engine)
    real_session = Session(bind=engine)
    spy = MagicMock(wraps=real_session)
    monkeypatch.setattr("app.db.session.SessionLocal", lambda: spy)
    yield spy
    real_session.close()


def test_session_scope_commits_and_closes_on_success(spied_session):
    with session_scope() as session:
        assert session is spied_session

    spied_session.commit.assert_called_once()
    spied_session.rollback.assert_not_called()
    spied_session.close.assert_called_once()


def test_session_scope_rolls_back_reraises_and_still_closes_on_error(spied_session):
    with pytest.raises(ValueError, match="boom"):
        with session_scope():
            raise ValueError("boom")

    spied_session.rollback.assert_called_once()
    spied_session.commit.assert_not_called()
    spied_session.close.assert_called_once()
