"""Ventes : détection → stock → CA → bénéfice prévisionnel → tâche d'expédition → notification."""
from datetime import timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from ..core.money import D, q2
from ..core import profit as P
from ..models import Expense, InventoryItem, Listing, Sale, Shipment, ShipmentEvent, now
from . import events, inventory as inv, settings as S

STATUSES = ["detected", "payment_pending", "payment_confirmed", "to_ship", "shipped", "delivered", "completed", "cancelled", "refunded"]
LABELS = {"detected": "Vente détectée", "payment_pending": "Paiement en attente", "payment_confirmed": "Paiement confirmé",
          "to_ship": "À expédier", "shipped": "Expédié", "delivered": "Livré", "completed": "Vente terminée",
          "cancelled": "Annulé", "refunded": "Remboursé"}
TRANSITIONS = {
    "detected": {"payment_pending", "payment_confirmed", "to_ship", "cancelled"},
    "payment_pending": {"payment_confirmed", "to_ship", "cancelled"},
    "payment_confirmed": {"to_ship", "cancelled"},
    "to_ship": {"shipped", "cancelled"},
    "shipped": {"delivered", "refunded", "cancelled"},
    "delivered": {"completed", "refunded"},
    "completed": {"refunded"},
    "cancelled": set(), "refunded": set(),
}
ACTIVE = {"detected", "payment_pending", "payment_confirmed", "to_ship", "shipped", "delivered"}


class SaleError(ValueError):
    pass


def figures(s: Sale) -> dict:
    """Chiffres d'une vente. Le CA est net des remboursements ; le coût de l'article n'est compté
    que s'il n'est pas retourné en stock."""
    price, refund = D(s.sale_price), D(s.refund_amount)
    if s.status == "cancelled":
        revenue, cost, fees = Decimal("0"), Decimal("0"), Decimal("0")
    else:
        revenue = q2(price - refund)
        fees = D(s.seller_fees)
        cost = Decimal("0") if (s.restocked and s.status in ("refunded",)) else D(s.item_cost)
    ship, pack = D(s.shipping_cost), D(s.packaging_cost)
    profit = q2(revenue - cost - fees - ship - pack)
    payout = q2(max(price - D(s.seller_fees) - refund, Decimal("0"))) if s.status != "cancelled" else Decimal("0.00")
    return {"revenue": q2(revenue), "item_cost": q2(cost), "fees": q2(fees), "shipping_cost": q2(ship), "packaging_cost": q2(pack),
            "profit": profit, "margin_pct": P.margin_pct(profit, revenue) if revenue > 0 else None, "payout": payout,
            "counts_as_sale": s.status != "cancelled"}


def create_sale(db: Session, *, item_id: int, sale_price, sold_at=None, order_ref=None, listing_url=None, seller_fees=None,
                shipping_cost=0, packaging_cost=0, payment_confirmed=False, actor="user") -> Sale:
    item = db.get(InventoryItem, item_id)
    if not item:
        raise SaleError("Article introuvable.")
    if item.status not in inv.SELLABLE or not inv.is_in_stock(item):
        raise SaleError(f"Article indisponible (« {inv.LABELS[item.status]} ») : il ne peut pas être vendu.")
    price = D(sale_price)
    if price <= 0:
        raise SaleError("Le prix de vente doit être positif.")
    cfg = S.get_all(db)
    fees = P.seller_fees(price, cfg["seller_fee_rate_pct"], cfg["seller_fee_fixed"]) if seller_fees is None else q2(seller_fees)
    listing = (db.query(Listing).filter(Listing.item_id == item.id, Listing.status.in_(["published", "ready", "draft"]))
               .order_by(Listing.id.desc()).first())
    sold_at = sold_at or now()
    sale = Sale(item_id=item.id, listing_id=listing.id if listing else None, order_ref=order_ref,
                listing_url=listing_url or item.listing_url or (listing.vinted_url if listing else None),
                sale_price=q2(price), sold_at=sold_at, item_cost=q2(D(item.unit_cost) + D(item.extra_cost)),
                seller_fees=fees, shipping_cost=q2(shipping_cost), packaging_cost=q2(packaging_cost),
                status="detected", payment_status="pending", delivery_status="to_ship")
    db.add(sale)
    inv.transition(item, "sold", force=True)  # 2. retiré du stock disponible
    item.listing_price = q2(price)
    if listing:
        listing.status = "sold"
    deadline = sold_at + timedelta(days=int(cfg["shipping_deadline_days"]))
    sale.shipment = Shipment(deadline=deadline, status="to_prepare")
    sale.shipment.events.append(ShipmentEvent(status="to_prepare", note="Tâche d'expédition créée automatiquement"))
    db.flush()
    _sync_sale_costs(db, sale)
    f = figures(sale)
    events.log(db, "sale_detected", f"Vente de « {item.name} » à {sale.sale_price} € (bénéfice prévisionnel {f['profit']} €)",
               actor=actor, entity="sale", entity_id=sale.id)
    events.notify(db, "sale_made", f"Vente : {item.name}", f"{sale.sale_price} € — bénéfice prévisionnel {f['profit']} €. À expédier avant le {deadline:%d/%m/%Y}.",
                  severity="success", link=f"/ventes/{sale.id}", dedupe_key=f"sale-{sale.id}")
    events.notify(db, "ship_due", f"À expédier : {item.name}", f"Date limite : {deadline:%d/%m/%Y}", severity="warning",
                  link="/expeditions", dedupe_key=f"ship-{sale.id}")
    from . import agents
    agents.publish(db, "sales_manager", "financial_analyst", "sale_recorded", {"sale_id": sale.id}, dedupe_key=f"sale-fin-{sale.id}")
    agents.publish(db, "sales_manager", "shipping_manager", "sale_to_ship", {"sale_id": sale.id}, dedupe_key=f"sale-ship-{sale.id}")
    if payment_confirmed:
        set_status(db, sale, "payment_confirmed", actor=actor)
    return sale


def _sync_sale_costs(db: Session, sale: Sale):
    """Écritures de caisse liées à la vente (expédition, emballage), recréées à chaque modification."""
    for e in db.query(Expense).filter(Expense.sale_id == sale.id, Expense.voided_at.is_(None)).all():
        db.delete(e)
    db.flush()
    if sale.status == "cancelled":
        return
    for cat, amount, label in (("expedition", sale.shipping_cost, "Frais d'expédition"), ("emballage", sale.packaging_cost, "Emballage")):
        if D(amount) > 0:
            db.add(Expense(date=sale.sold_at, category=cat, amount=q2(amount), auto=True, sale_id=sale.id,
                           description=f"{label} — vente #{sale.id}"))


def update_costs(db: Session, sale: Sale, *, seller_fees=None, shipping_cost=None, packaging_cost=None, order_ref=None, notes=None):
    if seller_fees is not None:
        sale.seller_fees = q2(seller_fees)
    if shipping_cost is not None:
        sale.shipping_cost = q2(shipping_cost)
    if packaging_cost is not None:
        sale.packaging_cost = q2(packaging_cost)
    if order_ref is not None:
        sale.order_ref = order_ref
    if notes is not None:
        sale.notes = notes
    _sync_sale_costs(db, sale)
    events.log(db, "sale_updated", f"Vente #{sale.id} : coûts mis à jour", entity="sale", entity_id=sale.id)


def set_status(db: Session, sale: Sale, new: str, *, actor="user", refund_amount=None, restock=False, tracking=None, carrier=None) -> Sale:
    if new not in STATUSES:
        raise SaleError(f"Statut inconnu : {new}")
    if new == sale.status:
        return sale
    if new not in TRANSITIONS[sale.status]:
        raise SaleError(f"Passage « {LABELS[sale.status]} » → « {LABELS[new]} » impossible.")
    item, ship = sale.item, sale.shipment
    if new == "payment_pending":
        sale.payment_status = "pending"
    elif new == "payment_confirmed":
        sale.payment_status = "confirmed"
        sale.status = "payment_confirmed"
        events.log(db, "payment_confirmed", f"Paiement confirmé pour la vente #{sale.id}", actor=actor, entity="sale", entity_id=sale.id)
        new = "to_ship"
        sale.payment_status = "confirmed"
    if new == "shipped":
        ship.status, ship.shipped_at = "shipped", now()
        ship.tracking_number = tracking or ship.tracking_number
        ship.carrier = carrier or ship.carrier
        ship.events.append(ShipmentEvent(status="shipped", note=f"Colis expédié{' — ' + ship.tracking_number if ship.tracking_number else ''}"))
        sale.delivery_status = "shipped"
        inv.transition(item, "shipped")
        events.notify(db, "parcel_shipped", f"Colis expédié : {item.name}", severity="info", link="/expeditions", dedupe_key=f"shipped-{sale.id}")
    elif new == "delivered":
        ship.status, ship.delivered_at = "delivered", now()
        ship.events.append(ShipmentEvent(status="delivered", note="Colis livré"))
        sale.delivery_status = "delivered"
    elif new == "completed":
        if sale.payout_received_at is None:
            raise SaleError("Enregistrez d'abord la réception du paiement (versement) avant de terminer la vente.")
        inv.transition(item, "done")
    elif new == "cancelled":
        if sale.delivery_status != "to_ship":
            raise SaleError("Une vente déjà expédiée ne peut plus être annulée : utilisez le remboursement.")
        inv.transition(item, "published" if item.listing_url else "received", force=True)
        item.listing_price = None
        if sale.listing_id and (l := db.get(Listing, sale.listing_id)):
            l.status = "published" if item.listing_url else "draft"
        ship.status = "problem"
        ship.events.append(ShipmentEvent(status="problem", note="Vente annulée"))
    elif new == "refunded":
        amount = D(sale.sale_price) if refund_amount is None else D(refund_amount)
        if amount <= 0 or amount > D(sale.sale_price):
            raise SaleError("Montant de remboursement invalide.")
        sale.refund_amount = q2(amount)
        sale.payment_status = "refunded"
        sale.restocked = bool(restock)
        if restock:
            item.status = "returned"
            item.received_at = item.received_at or now()
        events.notify(db, "refund", f"Remboursement : {item.name}", f"{q2(amount)} € remboursés", severity="danger",
                      link=f"/ventes/{sale.id}", dedupe_key=f"refund-{sale.id}")
    sale.status = new
    _sync_sale_costs(db, sale)
    events.log(db, "sale_status", f"Vente #{sale.id} → {LABELS[new]}", actor=actor, entity="sale", entity_id=sale.id)
    db.flush()
    return sale


def record_payout(db: Session, sale: Sale, received_at=None):
    if sale.status in ("cancelled", "refunded"):
        raise SaleError("Aucun versement pour une vente annulée ou remboursée.")
    if sale.delivery_status != "delivered":
        raise SaleError("Le versement Vinted intervient après la livraison : marquez d'abord le colis comme livré.")
    sale.payout_received_at = received_at or now()
    sale.payment_status = "paid_out"
    events.log(db, "payout_received", f"Paiement reçu pour la vente #{sale.id} : {figures(sale)['payout']} €", entity="sale", entity_id=sale.id)
    events.notify(db, "payout", f"Paiement reçu : {figures(sale)['payout']} €", sale.item.name, severity="success",
                  link=f"/ventes/{sale.id}", dedupe_key=f"payout-{sale.id}")
