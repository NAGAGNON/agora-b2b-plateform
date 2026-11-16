"""Authentification propriétaire (mot de passe unique → cookie signé) et chiffrement des secrets."""
import base64, hashlib, hmac, json, time
from cryptography.fernet import Fernet
from fastapi import Cookie, Header, HTTPException, Request
from .config import env

COOKIE = "rai_session"


def _key_bytes() -> bytes:
    sk = env().secret_key
    if not sk:
        raise RuntimeError("SECRET_KEY manquante : définissez-la (voir .env.example).")
    return hashlib.sha256(sk.encode()).digest()


def fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(_key_bytes()))


def encrypt(value: str) -> bytes:
    return fernet().encrypt(value.encode())


def decrypt(blob: bytes) -> str:
    return fernet().decrypt(blob).decode()


def check_password(password: str) -> bool:
    expected = env().admin_password
    if not expected:
        return False
    return hmac.compare_digest(hashlib.sha256(password.encode()).digest(), hashlib.sha256(expected.encode()).digest())


def make_token() -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + env().session_hours * 3600}).encode()).decode()
    sig = hmac.new(_key_bytes(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    payload, sig = token.rsplit(".", 1)
    good = hmac.new(_key_bytes(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, good):
        return False
    try:
        return json.loads(base64.urlsafe_b64decode(payload))["exp"] > time.time()
    except Exception:
        return False


def require_auth(request: Request):
    if not verify_token(request.cookies.get(COOKIE)):
        raise HTTPException(401, "Non authentifié")
