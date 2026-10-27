import logging
import secrets
import threading
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    TokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.system import RefreshToken, User
from app.services.exceptions import ConflictError, NotFoundError


class AuthError(Exception):
    """Raised for any auth failure that should surface as 401 to the API client."""


class SetupCodeError(Exception):
    """The first-run setup code is missing or wrong — 403."""


class WrongPasswordError(Exception):
    """The current password given to change it is wrong — 400."""


logger = logging.getLogger(__name__)

# Unambiguous characters only (no 0/O, 1/I/L), so the code is easy to read off a log.
_SETUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_setup_code: str | None = None
# Serialises "no users yet?" + "create the first one", so two setups racing can't both win.
_setup_lock = threading.Lock()


def get_setup_code() -> str:
    """The code the first-run setup form must be given: SETUP_CODE if set, otherwise one
    made up once per process (and printed to the log by announce_setup_code)."""
    global _setup_code
    configured = get_settings().setup_code
    if configured:
        return configured
    if _setup_code is None:
        raw = "".join(secrets.choice(_SETUP_CODE_ALPHABET) for _ in range(8))
        _setup_code = f"{raw[:4]}-{raw[4:]}"
    return _setup_code


def announce_setup_code(db: Session) -> None:
    """At startup, while no account exists, prints the setup code where only someone with
    access to the server sees it (`docker compose logs`)."""
    if db.query(User).count() > 0:
        return
    if get_settings().setup_code:
        logger.warning("No account yet. Open VideoGameTrackarr and use your SETUP_CODE to create one.")
        return
    logger.warning("No account yet. Open VideoGameTrackarr and enter this setup code: %s", get_setup_code())


def _normalise_code(code: str) -> str:
    return "".join(code.split()).replace("-", "").upper()


# Checked against when the username doesn't exist, so a wrong username takes as long as a wrong
# password and the response time doesn't reveal which usernames exist.
_DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        verify_password(password, _DUMMY_PASSWORD_HASH)
        raise AuthError("Invalid username or password")
    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid username or password")
    return user


def create_initial_admin(db: Session, username: str, password: str, setup_code: str) -> User:
    """Provisions the very first user account from the web setup flow. Re-checks
    emptiness here (not just at the route layer) so this can never become a backdoor
    register endpoint once an admin already exists — see app/api/routes/auth.py's /setup
    docstring for why a public register endpoint is deliberately not otherwise offered.
    The setup code keeps an instance that's reachable before its owner finishes setup from
    being claimed by whoever gets there first."""
    global _setup_code
    with _setup_lock:
        if db.query(User).count() > 0:
            raise ConflictError("Setup has already been completed.")
        if not secrets.compare_digest(_normalise_code(setup_code), _normalise_code(get_setup_code())):
            raise SetupCodeError("That setup code isn't right. It's printed in the server's log.")

        user = User(username=username, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        _setup_code = None
        return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Sets a new password and revokes every refresh token the user has, so other browsers
    and devices are signed out once their short-lived access token runs out. The caller
    issues fresh tokens for the session that made the change."""
    if not verify_password(current_password, user.password_hash):
        raise WrongPasswordError("The current password is incorrect.")

    user.password_hash = hash_password(new_password)
    _revoke_all(db, user.id)


def _revoke_all(db: Session, user_id: int) -> None:
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).update(
        {RefreshToken.revoked_at: datetime.now(UTC)}, synchronize_session=False
    )
    db.commit()


# Two tabs can refresh with the same token at nearly the same moment; only a rotated token
# presented again after this long is treated as stolen.
REUSE_GRACE_SECONDS = 30


def set_preferences(
    db: Session,
    user: User,
    currency: str | None = None,
    overview_layout: list[dict] | None = None,
    game_filter_fields: list[dict] | None = None,
    saved_game_filters: list[dict] | None = None,
) -> User:
    """Changes only what's given (None leaves a preference as it is)."""
    if currency is not None:
        user.currency = currency
    if overview_layout is not None:
        user.overview_layout = overview_layout
    if game_filter_fields is not None:
        user.game_filter_fields = game_filter_fields
    if saved_game_filters is not None:
        user.saved_game_filters = saved_game_filters
    db.commit()
    db.refresh(user)
    return user


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token, refresh_token, _ = _issue_tokens(db, user)
    return access_token, refresh_token


def _issue_tokens(db: Session, user: User) -> tuple[str, str, str]:
    access_token = create_access_token(user.id)
    refresh_token, jti, expires_at = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, jti=jti, expires_at=expires_at))
    db.commit()
    return access_token, refresh_token, jti


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str]:
    """Validates a refresh token, revokes it, and issues a fresh access+refresh pair.
    Rotation means a stolen refresh token can be replayed at most once before the
    legitimate client's next refresh fails loudly (the record is already revoked)."""
    _detect_reuse(db, refresh_token)
    record, user = _load_active_refresh_token(db, refresh_token)

    record.revoked_at = datetime.now(UTC)
    db.flush()

    access_token, new_refresh_token, new_jti = _issue_tokens(db, user)
    record.replaced_by_jti = new_jti
    db.commit()
    return access_token, new_refresh_token


def _detect_reuse(db: Session, refresh_token: str) -> None:
    """A rotated refresh token presented again means someone else has a copy: sign every
    session out (the thief's and the owner's), so the owner signs back in and the copy is
    useless. Tokens revoked by logout or a password change aren't "reuse" and are just
    refused as before."""
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError:
        return
    record = db.query(RefreshToken).filter(RefreshToken.jti == payload.get("jti")).first()
    if record is None or record.replaced_by_jti is None or record.revoked_at is None:
        return
    revoked_at = record.revoked_at if record.revoked_at.tzinfo else record.revoked_at.replace(tzinfo=UTC)
    if (datetime.now(UTC) - revoked_at).total_seconds() > REUSE_GRACE_SECONDS:
        _revoke_all(db, record.user_id)
        raise AuthError("Refresh token reuse detected; all sessions have been signed out")


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    try:
        record, _ = _load_active_refresh_token(db, refresh_token)
    except AuthError:
        return  # logout is idempotent: an already-invalid token is not an error

    record.revoked_at = datetime.now(UTC)
    db.commit()


def get_share_token(user: User) -> str | None:
    """The share token if sharing is on, without creating one — viewing Settings must not
    publish anything."""
    return user.public_share_token


def disable_share_token(db: Session, user: User) -> None:
    """Turns sharing off: both share links stop working until it's turned on again (which
    makes a new token, so the old links never come back)."""
    user.public_share_token = None
    db.commit()


def get_or_create_share_token(db: Session, user: User) -> str:
    if user.public_share_token is None:
        user.public_share_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(user)
    return user.public_share_token


def regenerate_share_token(db: Session, user: User) -> str:
    # Regenerating immediately breaks every URL built from the old token, so a leaked link
    # can be revoked while sharing stays on (there's no per-link revocation).
    user.public_share_token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(user)
    return user.public_share_token


def get_user_by_share_token(db: Session, token: str) -> User:
    # 404, not 401/403 — a wrong/guessed token shouldn't be distinguishable from a
    # not-found route, so a bad guess can't tell an attacker they're "close."
    user = db.query(User).filter(User.public_share_token == token).first()
    if user is None:
        raise NotFoundError("Share link not found")
    return user


def _load_active_refresh_token(db: Session, refresh_token: str) -> tuple[RefreshToken, User]:
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError as exc:
        raise AuthError(str(exc)) from exc

    record = db.query(RefreshToken).filter(RefreshToken.jti == payload.get("jti")).first()
    if record is None or record.revoked_at is not None:
        raise AuthError("Refresh token has been revoked")

    user = db.get(User, record.user_id)
    if user is None:
        raise AuthError("User no longer exists")

    return record, user
