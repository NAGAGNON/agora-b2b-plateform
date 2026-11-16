"""Configuration par variables d'environnement (jamais de secret en dur)."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://reseller:reseller@localhost:5432/reseller"
    # Mot de passe unique du propriétaire. OBLIGATOIRE : sans lui, l'API refuse de démarrer l'auth.
    admin_password: str = ""
    # Clé de chiffrement des secrets (Fernet, 32 octets urlsafe base64) et de signature des sessions.
    secret_key: str = ""
    anthropic_api_key: str = ""
    storage_dir: str = "storage"
    scheduler_enabled: bool = True
    cookie_secure: bool = False
    session_hours: int = 24 * 7
    # SMTP optionnel pour les e-mails de notification
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    allow_private_urls: bool = False  # SSRF : n'activer qu'en test
    timezone: str = "Europe/Paris"


@lru_cache
def env() -> Env:
    return Env()
