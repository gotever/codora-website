from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from fastapi import Cookie, HTTPException

from .settings import settings

hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return hasher.verify(password_hash, password)
    except (VerificationError, VerifyMismatchError):
        return False


def make_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "email": email, "iat": now, "exp": now + timedelta(days=7)}, settings.jwt_secret, algorithm="HS256")


def current_user_id(codora_session: str | None = Cookie(default=None)) -> str:
    if not codora_session:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(codora_session, settings.jwt_secret, algorithms=["HS256"])
        return str(UUID(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Authentication required") from None


def optional_user_id(codora_session: str | None = Cookie(default=None)) -> str | None:
    if not codora_session:
        return None
    try:
        payload = jwt.decode(codora_session, settings.jwt_secret, algorithms=["HS256"])
        return str(UUID(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None

