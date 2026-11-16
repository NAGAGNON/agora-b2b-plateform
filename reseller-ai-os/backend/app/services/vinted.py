"""Module Vinted. Mode assisté pleinement fonctionnel ; connecteur API officiel = interface honnête.

L'accès à l'API « Vinted Pro Integrations » doit être accordé par Vinted. Tant que ce n'est pas le cas
(api_status != granted ET jeton configuré), AUCUNE opération API n'est tentée ni simulée. Aucun robot,
aucun script d'automatisation du site : la publication se fait manuellement par l'utilisateur."""
import re
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from ..models import InventoryItem, Listing, Secret, VintedAccount, now
from . import events, inventory as inv, listing as listing_svc, settings as S

VINTED_HOST = re.compile(r"(^|\.)vinted\.(fr|com|de|es|it|nl|be|pl|pt|lt|cz|at|co\.uk|lu|se|dk|fi|hu|ro|sk|hr|gr|ie)$", re.I)


class VintedError(ValueError):
    pass


def account(db: Session) -> VintedAccount:
    a = db.query(VintedAccount).first()
    if not a:
        a = VintedAccount()
        db.add(a)
        db.flush()
    return a


def connector_status(db: Session) -> dict:
    a = account(db)
    has_token = db.get(Secret, "vinted_api_token") is not None
    available = a.api_status == "granted" and has_token and bool(a.api_base_url)
    return {"api_status": a.api_status, "token_configured": has_token, "available": available,
            "effective_mode": "api" if available and a.mode == "api" else "assisted",
            "message": ("Connecteur API prêt." if available else
                        "API Vinted Pro Integrations non accordée/configurée : le mode assisté est utilisé. "
                        "Aucune action API n'est tentée tant que l'accès n'est pas effectivement accordé."),
            "supported_when_granted": ["Création d'annonces", "Modification", "Synchronisation", "Commandes", "Notifications de vente", "Suivi d'expédition"]}


def require_api(db: Session):
    st = connector_status(db)
    if not st["available"]:
        raise VintedError(st["message"])
    raise VintedError("Connecteur API non implémenté : à développer sur la base de la documentation officielle fournie avec l'accès accordé.")


def publication_pack(db: Session, listing: Listing) -> dict:
    item = listing.item
    chk = listing_svc.compliance(db, listing.title, listing.description, item.photos, listing.price)
    return {"listing_id": listing.id, "title": listing.title, "description": listing.description, "price": listing.price,
            "category": listing.vinted_category, "keywords": listing.keywords, "compliance": chk,
            "photos": [{"id": p.id, "url": f"/api/photos/{p.id}/file", "is_real_photo": p.is_real_photo, "kind": p.kind} for p in item.photos],
            "open_url": S.get(db, "vinted_new_item_url"),
            "steps": ["Copiez le titre, la description et le prix.", "Téléchargez les photos (ZIP) et ajoutez-les dans l'ordre.",
                      "Publiez sur Vinted depuis votre compte.", "Collez ici le lien de l'annonce publiée pour finaliser le suivi."]}


def mark_ready(db: Session, listing: Listing):
    item = listing.item
    chk = listing_svc.compliance(db, listing.title, listing.description, item.photos, listing.price)
    if not chk["ok"]:
        raise VintedError("Annonce non conforme : " + " ".join(chk["errors"]))
    listing.status = "ready"
    if item.status in ("received", "to_photograph"):
        inv.transition(item, "ready")
    events.log(db, "listing_ready", f"Annonce prête : « {item.name} »", actor="listing_creator", entity="listing", entity_id=listing.id)
    events.notify(db, "listing_ready", f"Annonce prête : {item.name}", f"{listing.price} € — à publier sur Vinted", severity="info",
                  link=f"/annonces/{listing.id}", dedupe_key=f"listing-ready-{listing.id}")


def confirm_published(db: Session, listing: Listing, url: str):
    host = urlparse(url).hostname or ""
    if urlparse(url).scheme not in ("http", "https") or not VINTED_HOST.search(host):
        raise VintedError("Le lien doit être celui d'une annonce Vinted (ex. https://www.vinted.fr/items/…).")
    if "/items/" not in url:
        raise VintedError("Le lien doit pointer vers une annonce (/items/…).")
    item = listing.item
    if not inv.is_in_stock(item):
        raise VintedError("Article non disponible en stock : publication impossible.")
    chk = listing_svc.compliance(db, listing.title, listing.description, item.photos, listing.price)
    if not chk["ok"]:
        raise VintedError("Annonce non conforme : " + " ".join(chk["errors"]))
    listing.vinted_url, listing.status, listing.published_at, listing.mode = url, "published", now(), "assisted"
    item.listing_url, item.listing_price = url, listing.price
    if item.status in ("received", "to_photograph"):
        inv.transition(item, "ready")
    if item.status != "published":
        inv.transition(item, "published")
    events.log(db, "listing_published", f"Annonce publiée : « {item.name} » à {listing.price} €", entity="listing", entity_id=listing.id,
               payload={"url": url})
    events.notify(db, "listing_published", f"Annonce publiée : {item.name}", url, severity="success", link="/vinted",
                  dedupe_key=f"listing-published-{listing.id}")
