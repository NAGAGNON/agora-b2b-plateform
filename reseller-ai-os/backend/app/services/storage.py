"""Stockage de fichiers : disque local (Docker/VPS) ou Supabase Storage (serverless). Les clés sont des chemins relatifs."""
from pathlib import Path
import httpx
from ..config import env


class StorageError(RuntimeError):
    pass


def _local(key: str) -> Path:
    root = Path(env().storage_dir).resolve()
    p = (root / key).resolve()
    if root not in p.parents:
        raise StorageError("Chemin invalide.")
    return p


def _url(key: str) -> str:
    e = env()
    if not (e.supabase_url and e.supabase_service_key):
        raise StorageError("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants pour le stockage Supabase.")
    return f"{e.supabase_url.rstrip('/')}/storage/v1/object/{e.storage_bucket}/{key}"


def _headers(extra: dict | None = None) -> dict:
    k = env().supabase_service_key
    return {"Authorization": f"Bearer {k}", "apikey": k, **(extra or {})}


def _check(r: httpx.Response, what: str):
    if r.status_code >= 400:
        raise StorageError(f"Stockage ({what}) : HTTP {r.status_code} {r.text[:200]}")


def put(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    if env().storage_backend == "supabase":
        r = httpx.post(_url(key), content=data, timeout=30, headers=_headers({"Content-Type": content_type, "x-upsert": "true"}))
        _check(r, "écriture")
        return
    p = _local(key)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)


def get(key: str) -> bytes:
    if env().storage_backend == "supabase":
        r = httpx.get(_url(key), timeout=30, headers=_headers())
        _check(r, "lecture")
        return r.content
    p = _local(key)
    if not p.exists():
        raise StorageError("Fichier introuvable.")
    return p.read_bytes()


def delete(key: str) -> None:
    if env().storage_backend == "supabase":
        r = httpx.delete(_url(key), timeout=30, headers=_headers())
        if r.status_code != 404:
            _check(r, "suppression")
        return
    _local(key).unlink(missing_ok=True)
