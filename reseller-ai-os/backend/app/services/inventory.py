"""Machine d'états du stock. Un article n'est « en stock » que s'il est physiquement reçu et non vendu."""
from datetime import timedelta
from sqlalchemy.orm import Session
from ..models import InventoryItem, now

STATUSES = ["ordered", "in_transit", "received", "to_photograph", "ready", "published", "reserved",
            "sold", "shipped", "done", "returned"]
LABELS = {"ordered": "Commandé", "in_transit": "En transit", "received": "Reçu", "to_photograph": "À photographier",
          "ready": "Prêt à publier", "published": "Publié", "reserved": "Réservé", "sold": "Vendu",
          "shipped": "Expédié", "done": "Terminé", "returned": "Retourné"}
# Statuts où l'article est physiquement détenu et invendu
IN_STOCK = {"received", "to_photograph", "ready", "published", "reserved", "returned"}
# Statuts « vendables » (peut recevoir une vente)
SELLABLE = {"received", "to_photograph", "ready", "published", "reserved"}
UNAVAILABLE = {"ordered", "in_transit", "sold", "shipped", "done"}

TRANSITIONS = {
    "ordered": {"in_transit", "received"},
    "in_transit": {"received", "ordered"},
    "received": {"to_photograph", "ready", "published", "reserved"},
    "to_photograph": {"ready", "published", "received"},
    "ready": {"published", "to_photograph", "received"},
    "published": {"reserved", "sold", "ready", "received"},
    "reserved": {"published", "sold"},
    "sold": {"shipped", "returned", "published", "received"},
    "shipped": {"done", "returned"},
    "done": {"returned"},
    "returned": {"received", "to_photograph", "ready", "published"},
}


class InvalidTransition(ValueError):
    pass


def is_in_stock(item: InventoryItem) -> bool:
    return item.status in IN_STOCK and item.received_at is not None and item.quantity > 0


def transition(item: InventoryItem, new_status: str, *, force=False):
    if new_status not in STATUSES:
        raise InvalidTransition(f"Statut inconnu : {new_status}")
    if new_status == item.status:
        return
    if not force and new_status not in TRANSITIONS.get(item.status, set()):
        raise InvalidTransition(f"Passage « {LABELS[item.status]} » → « {LABELS[new_status]} » impossible.")
    if new_status in IN_STOCK | {"sold"} and item.status in ("ordered", "in_transit") and new_status != "received":
        raise InvalidTransition("Un article non reçu ne peut pas être présenté en stock ou vendu.")
    if new_status == "received" and item.received_at is None:
        item.received_at = now()
    item.status = new_status
    if new_status == "published" and item.published_at is None:
        item.published_at = now()


def unpublished_after_reception(db: Session, days: int):
    limit = now() - timedelta(days=days)
    return (db.query(InventoryItem)
            .filter(InventoryItem.status.in_(["received", "to_photograph", "ready"]), InventoryItem.received_at <= limit)
            .order_by(InventoryItem.received_at).all())


def next_sku(db: Session) -> str:
    n = db.query(InventoryItem).count() + 1
    while True:
        sku = f"RAI-{n:05d}"
        if not db.query(InventoryItem).filter_by(sku=sku).first():
            return sku
        n += 1
