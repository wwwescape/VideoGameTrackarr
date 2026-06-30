"""Create (or reset the password of) the single admin account for this instance.

There is deliberately no public "register" endpoint — see roadmap decision on auth scope
(single admin account, not multi-tenant) — so this CLI is the only way to provision or
reset the login used by /api/auth/login.

Usage:
    python -m scripts.create_admin --username admin
    python -m scripts.create_admin --username admin --password "..."   # non-interactive
"""

import argparse
import getpass

from app.core.security import hash_password
from app.db.session import session_scope
from app.models.system import User


def create_or_update_admin(username: str, password: str) -> str:
    with session_scope() as session:
        user = session.query(User).filter(User.username == username).first()
        password_hash = hash_password(password)

        if user is None:
            session.add(User(username=username, password_hash=password_hash))
            return f"Created admin user '{username}'."

        user.password_hash = password_hash
        return f"Updated password for existing user '{username}'."


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", help="If omitted, you'll be prompted (not echoed to the terminal)")
    args = parser.parse_args()

    password = args.password or getpass.getpass("New password: ")
    if not password:
        raise SystemExit("Password must not be empty.")

    message = create_or_update_admin(args.username, password)
    print(message)


if __name__ == "__main__":
    main()
