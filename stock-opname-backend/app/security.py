from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

ALGO = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        # hash belum diisi / rusak
        return False


def buat_token(pengguna_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.token_hari)
    return jwt.encode({"sub": str(pengguna_id), "exp": exp}, settings.secret_key, algorithm=ALGO)


def baca_token(token: str) -> int | None:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[ALGO])
        return int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None