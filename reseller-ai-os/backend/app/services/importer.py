"""Import de catalogues (CSV fichier/URL, JSON URL) avec protection SSRF. Aucune collecte non autorisée."""
import csv, io, ipaddress, json, socket
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse
import httpx
from sqlalchemy.orm import Session
from ..config import env
from ..core.money import D, q2
from ..models import Opportunity, Secret, Source, Supplier, now
from ..security import decrypt
from . import events

FIELDS = ["external_ref", "name", "image_url", "brand", "category", "description", "supplier_url", "availability",
          "purchase_price", "shipping_cost", "manual_resale_price"]
ALIASES = {
    "external_ref": ["id", "ref", "reference", "référence", "sku", "product_id", "goods_id"],
    "name": ["name", "nom", "title", "titre", "product", "produit", "goods_name"],
    "image_url": ["image", "image_url", "photo", "img", "picture"],
    "brand": ["brand", "marque"],
    "category": ["category", "catégorie", "categorie", "type"],
    "description": ["description", "desc"],
    "supplier_url": ["url", "link", "lien", "product_url"],
    "availability": ["availability", "stock", "disponibilité", "disponibilite", "in_stock"],
    "purchase_price": ["price", "prix", "prix_achat", "purchase_price", "cost", "wholesale_price", "prix_ht"],
    "shipping_cost": ["shipping", "livraison", "frais_livraison", "shipping_cost"],
    "manual_resale_price": ["resale_price", "prix_revente", "prix_de_revente", "revente", "resale"],
}


class ImportError_(ValueError):
    pass


def assert_public_url(url: str):
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ImportError_("URL invalide (http/https requis).")
    if env().allow_private_urls:
        return
    try:
        infos = socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80))
    except socket.gaierror as e:
        raise ImportError_(f"Hôte introuvable : {u.hostname}") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ImportError_("Adresse non publique refusée (protection SSRF).")


def guess_mapping(columns: list[str]) -> dict:
    low = {c.lower().strip(): c for c in columns}
    m = {}
    for field, aliases in ALIASES.items():
        for a in aliases:
            if a in low:
                m[field] = low[a]
                break
    return m


def _avail(v) -> str:
    s = str(v or "").strip().lower()
    if s in ("1", "true", "yes", "oui", "in_stock", "instock", "disponible", "en stock"):
        return "in_stock"
    if s in ("0", "false", "no", "non", "out_of_stock", "outofstock", "rupture", "indisponible"):
        return "out_of_stock"
    return "unknown"


def parse_csv(text: str) -> tuple[list[str], list[dict]]:
    text = text.lstrip("﻿")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = list(reader)
    return list(reader.fieldnames or []), rows


def _dig(obj, path: str | None):
    if not path:
        return obj
    for part in path.split("."):
        obj = obj[part] if isinstance(obj, dict) else obj[int(part)]
    return obj


def fetch(db: Session, src: Source) -> tuple[list[str], list[dict]]:
    if not src.url:
        raise ImportError_("Aucune URL configurée pour cette source.")
    assert_public_url(src.url)
    headers = {}
    if src.secret_name and src.header_name:
        sec = db.get(Secret, src.secret_name)
        if not sec:
            raise ImportError_(f"Secret « {src.secret_name} » introuvable.")
        headers[src.header_name] = decrypt(sec.ciphertext)
    with httpx.Client(timeout=30, follow_redirects=False, headers={"User-Agent": "ResellerAIOS/1.0"}) as c:
        r = c.get(src.url, headers=headers)
    if r.status_code != 200:
        raise ImportError_(f"La source a répondu HTTP {r.status_code}.")
    if len(r.content) > 20_000_000:
        raise ImportError_("Fichier trop volumineux (> 20 Mo).")
    if src.kind == "json_url":
        data = _dig(r.json(), src.json_path)
        if not isinstance(data, list):
            raise ImportError_("Le JSON ne contient pas une liste d'articles à l'endroit indiqué (json_path).")
        cols = sorted({k for d in data if isinstance(d, dict) for k in d})
        return cols, [d for d in data if isinstance(d, dict)]
    return parse_csv(r.text)


def ingest(db: Session, src: Source, columns: list[str], rows: list[dict], limit: int | None = None) -> dict:
    mapping = src.mapping or guess_mapping(columns)
    if "name" not in mapping or "purchase_price" not in mapping:
        raise ImportError_("Correspondance de colonnes incomplète : « name » et « purchase_price » sont obligatoires. "
                           f"Colonnes détectées : {', '.join(columns)}")
    created = updated = skipped = 0
    errors: list[str] = []
    rate = D(src.currency_rate or 1)
    for i, row in enumerate(rows[: limit or None], start=2):
        try:
            def g(f):
                col = mapping.get(f)
                return row.get(col) if col else None
            name = str(g("name") or "").strip()
            price = g("purchase_price")
            if not name or price in (None, ""):
                skipped += 1
                continue
            price = q2(D(price) * rate)
            if price < 0:
                raise ValueError("prix négatif")
            ext = str(g("external_ref") or g("supplier_url") or name).strip()[:300]
            opp = db.query(Opportunity).filter_by(source_id=src.id, external_ref=ext).first()
            data = dict(name=name[:300], image_url=g("image_url"), brand=g("brand"), category=g("category"),
                        description=g("description"), supplier_url=g("supplier_url"), availability=_avail(g("availability")),
                        purchase_price=price, last_checked_at=now())
            if g("shipping_cost") not in (None, ""):
                data["shipping_cost"] = q2(D(g("shipping_cost")) * rate)
            if g("manual_resale_price") not in (None, ""):
                data["manual_resale_price"] = q2(g("manual_resale_price"))
            if opp:
                for k, v in data.items():
                    if v is not None:
                        setattr(opp, k, v)
                updated += 1
            else:
                db.add(Opportunity(source_id=src.id, supplier_id=src.supplier_id, external_ref=ext, **{k: v for k, v in data.items() if v is not None}))
                created += 1
            if (created + updated) % 200 == 0:
                db.flush()
        except (InvalidOperation, ValueError) as e:
            errors.append(f"ligne {i} : {e}")
    src.last_sync_at, src.last_count = now(), created + updated
    src.last_status = f"OK : {created} créé(s), {updated} mis à jour, {skipped} ignoré(s), {len(errors)} erreur(s)"
    db.flush()
    events.log(db, "source_synced", f"Source « {src.name} » : {src.last_status}", actor="opportunity_hunter", entity="source", entity_id=src.id)
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors[:20]}


def sync_source(db: Session, src: Source, limit=None) -> dict:
    if src.kind == "csv_file":
        raise ImportError_("Source fichier : importez un nouveau fichier CSV (pas de re-synchronisation automatique).")
    cols, rows = fetch(db, src)
    return ingest(db, src, cols, rows, limit)
