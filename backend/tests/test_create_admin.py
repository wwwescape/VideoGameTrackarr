from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models import Base
from app.models.system import User
from scripts.create_admin import create_or_update_admin


def _patched_session_scope(engine):
    from contextlib import contextmanager

    @contextmanager
    def _scope():
        session = Session(bind=engine)
        try:
            yield session
            session.commit()
        finally:
            session.close()

    return _scope


def test_create_admin_creates_new_user(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'admin.db').as_posix()}")
    Base.metadata.create_all(engine)
    monkeypatch.setattr("scripts.create_admin.session_scope", _patched_session_scope(engine))

    message = create_or_update_admin("admin", "s3cret")

    with Session(bind=engine) as session:
        user = session.query(User).filter_by(username="admin").one()
        assert verify_password("s3cret", user.password_hash)
    assert "Created" in message


def test_create_admin_updates_existing_user_password(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'admin.db').as_posix()}")
    Base.metadata.create_all(engine)
    monkeypatch.setattr("scripts.create_admin.session_scope", _patched_session_scope(engine))

    create_or_update_admin("admin", "first-password")
    message = create_or_update_admin("admin", "second-password")

    with Session(bind=engine) as session:
        users = session.query(User).filter_by(username="admin").all()
        assert len(users) == 1
        assert verify_password("second-password", users[0].password_hash)
    assert "Updated" in message
