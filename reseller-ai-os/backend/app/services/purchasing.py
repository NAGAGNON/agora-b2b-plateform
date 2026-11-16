"""Achats fournisseurs : workflow, validation explicite, budgets, comptabilisation automatique."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..core.money import D, q2
from ..core.allocation import unit_costs
from ..models import (Expense, InventoryItem, Opportunity, PurchaseLine, PurchaseOrder, now)
from . import events, inventory as inv, settings as S

STATUSES = ["to_study", "recommended", "awaiting_validation", "validated", "ordered", "shipped", "received", "cancelled"]
LABELS = {"to_study": "À étudier", "recommended": "Achat recommandé", "awaiting_validation": "En attente de validation",
          "validated": "Commande validée", "ordered": "Commandée", "shipped": "Expédiée par fournisseur",
          "received": "Reçue", "cancelled": "Annulée"}
TRANSITIONS = {
    "to_study": {"recommended", "awaiting_validation", "cancelled"},
    "recommended": {"to_study", "awaiting_validation", "cancelled"},
    "awaiting_validation": {"to_study", "validated", "cancelled"},
    "validated": {"ordered", "awaiting_validation", "cancelled"},
    "ordered": {"shipped", "received", "cancelled"},
    "shipped": {"received", "cancelled"},
    "received": set(), "cancelled": set(),
}
OPEN = {"to_study", "recommended", "awaiting_validation", "validated", "ordered", "shipped"}
EDITABLE = {"to_study", "recommended", "awaiting_validation"}


class PurchaseError(ValueError):
    pass


def lines_total(order: PurchaseOrder) -> Decimal:
    return q2(sum((D(l.unit_price) * l.quantity for l in order.lines), Decimal("0")))


def order_total(order: PurchaseOrder) -> Decimal:
    return q2(lines_total(order) + D(order.shipping_cost) + D(order.other_fees))


def _month_bounds(ref: datetime):
    start = ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)
    return start, end


def purchases_spent(db: Session, start: datetime, end: datetime) -> Decimal:
    v = (db.query(func.coalesce(func.sum(Expense.amount), 0))
         .filter(Expense.purchase_order_id.isnot(None), Expense.voided_at.is_(None), Expense.date >= start, Expense.date < end).scalar())
    return q2(v)


def committed(db: Session, exclude_id: int | None = None) -> Decimal:
    """Commandes validées mais pas encore passées : argent engagé, pas encore sorti."""
    total = Decimal("0")
    for o in db.query(PurchaseOrder).filter(PurchaseOrder.status == "validated").all():
        if o.id != exclude_id:
            total += order_total(o)
    return q2(total)


def budget_status(db: Session, exclude_id: int | None = None) -> dict:
    cfg = S.get_all(db)
    n = now()
    m0, m1 = _month_bounds(n)
    d0 = n.replace(hour=0, minute=0, second=0, microsecond=0)
    spent_m = purchases_spent(db, m0, m1)
    spent_d = purchases_spent(db, d0, d0 + timedelta(days=1))
    com = committed(db, exclude_id)
    bm, bd = D(cfg["budget_monthly"]), D(cfg["budget_daily"])
    return {
        "monthly_budget": bm, "monthly_spent": spent_m, "committed": com,
        "monthly_remaining": q2(bm - spent_m - com) if bm > 0 else None,
        "daily_budget": bd, "daily_spent": spent_d,
        "daily_remaining": q2(bd - spent_d - com) if bd > 0 else None,
        "per_purchase_budget": D(cfg["budget_per_purchase"]),
    }


def check_budget(db: Session, order: PurchaseOrder) -> list[str]:
    total = order_total(order)
    b = budget_status(db, exclude_id=order.id)
    problems = []
    if b["per_purchase_budget"] > 0 and total > b["per_purchase_budget"]:
        problems.append(f"Montant {total} € > budget par achat ({b['per_purchase_budget']} €)")
    if b["monthly_remaining"] is not None and total > b["monthly_remaining"]:
        problems.append(f"Montant {total} € > budget mensuel restant ({b['monthly_remaining']} €)")
    if b["daily_remaining"] is not None and total > b["daily_remaining"]:
        problems.append(f"Montant {total} € > budget quotidien restant ({b['daily_remaining']} €)")
    return problems


def create_order(db: Session, *, supplier_id=None, lines: list[dict], shipping_cost=0, other_fees=0, reference=None,
                 supplier_url=None, notes=None, status="to_study", auto_prepared=False) -> PurchaseOrder:
    if not lines:
        raise PurchaseError("Une commande doit contenir au moins une ligne.")
    o = PurchaseOrder(supplier_id=supplier_id, shipping_cost=q2(shipping_cost), other_fees=q2(other_fees), reference=reference,
                      supplier_url=supplier_url, notes=notes, status=status, auto_prepared=auto_prepared)
    for ln in lines:
        add_line(o, ln)
    db.add(o)
    db.flush()
    events.log(db, "purchase_created", f"Commande #{o.id} créée ({len(o.lines)} ligne(s), {order_total(o)} €)",
               entity="purchase_order", entity_id=o.id)
    return o


def add_line(order: PurchaseOrder, ln: dict):
    qty = int(ln.get("quantity", 1))
    price = D(ln["unit_price"])
    if qty < 1:
        raise PurchaseError("Quantité ≥ 1 requise.")
    if price < 0:
        raise PurchaseError("Prix négatif interdit.")
    order.lines.append(PurchaseLine(
        name=ln["name"], unit_price=q2(price), quantity=qty, opportunity_id=ln.get("opportunity_id"),
        category=ln.get("category"), brand=ln.get("brand"), image_url=ln.get("image_url"),
        supplier_url=ln.get("supplier_url"), planned_resale_price=ln.get("planned_resale_price")))


def set_status(db: Session, order: PurchaseOrder, new: str, *, actor="user", override_budget=False,
               tracking=None, reference=None) -> PurchaseOrder:
    if new not in STATUSES:
        raise PurchaseError(f"Statut inconnu : {new}")
    if new == order.status:
        return order
    if new not in TRANSITIONS[order.status]:
        raise PurchaseError(f"Passage « {LABELS[order.status]} » → « {LABELS[new]} » impossible.")
    if reference:
        order.reference = reference
    if tracking:
        order.tracking_number = tracking
    if new == "validated":
        if actor not in ("user",):
            raise PurchaseError("Seul le propriétaire peut valider un achat.")
        problems = check_budget(db, order)
        if problems and not override_budget:
            raise PurchaseError("Budget dépassé : " + " ; ".join(problems) + " (validation forcée possible, explicitement).")
        order.approved_at = now()
        for l in order.lines:
            if l.opportunity_id and (opp := db.get(Opportunity, l.opportunity_id)):
                opp.status = "validated"
        events.log(db, "purchase_validated", f"Achat #{order.id} validé ({order_total(order)} €)", actor=actor,
                   entity="purchase_order", entity_id=order.id, payload={"override_budget": override_budget, "problems": problems})
    elif new == "ordered":
        if order.approved_at is None:
            raise PurchaseError("Un achat doit être validé par vous avant d'être marqué « Commandé ».")
        _mark_ordered(db, order)
    elif new == "shipped":
        order.shipped_at = now()
        for it in _items(db, order):
            if it.status == "ordered":
                inv.transition(it, "in_transit")
        events.notify(db, "supplier_shipped", f"Commande #{order.id} expédiée par le fournisseur",
                      order.tracking_number and f"Suivi : {order.tracking_number}", link=f"/achats/{order.id}", severity="info",
                      dedupe_key=f"po-shipped-{order.id}")
    elif new == "received":
        if order.status in ("validated", "awaiting_validation", "to_study", "recommended"):
            raise PurchaseError("Commande non passée : impossible de la réceptionner.")
        _receive(db, order)
    elif new == "cancelled":
        _cancel(db, order)
    order.status = new
    events.log(db, "purchase_status", f"Commande #{order.id} → {LABELS[new]}", actor=actor, entity="purchase_order", entity_id=order.id)
    db.flush()
    return order


def _items(db: Session, order: PurchaseOrder):
    return db.query(InventoryItem).filter(InventoryItem.order_id == order.id).order_by(InventoryItem.id).all()


def _mark_ordered(db: Session, order: PurchaseOrder):
    order.ordered_at = now()
    costs = unit_costs([{"unit_price": l.unit_price, "quantity": l.quantity} for l in order.lines],
                       D(order.shipping_cost) + D(order.other_fees))
    for line, per_unit in zip(order.lines, costs):
        for c in per_unit:
            db.add(InventoryItem(
                sku=_sku(db), name=line.name, brand=line.brand,
                category=line.category, supplier_id=order.supplier_id, order_id=order.id, line_id=line.id,
                purchase_date=order.ordered_at, purchase_price=line.unit_price, unit_cost=c, quantity=1, status="ordered",
                planned_price=line.planned_resale_price))
            db.flush()
    total = order_total(order)
    db.add(Expense(date=order.ordered_at, category="achats_fournisseurs", amount=total, auto=True, purchase_order_id=order.id,
                   description=f"Commande fournisseur #{order.id}" + (f" ({order.reference})" if order.reference else ""),
                   vendor=order.supplier.name if order.supplier else None))
    for l in order.lines:
        if l.opportunity_id and (opp := db.get(Opportunity, l.opportunity_id)):
            opp.status = "purchased"
    events.log(db, "purchase_ordered", f"Commande #{order.id} passée : {total} € enregistrés en dépenses", entity="purchase_order", entity_id=order.id)
    events.notify(db, "purchase_ordered", f"Achat enregistré : {total} €", f"Commande #{order.id}", severity="success",
                  link=f"/achats/{order.id}", dedupe_key=f"po-ordered-{order.id}")
    _budget_alert(db)


def _sku(db: Session) -> str:
    return inv.next_sku(db)


def _receive(db: Session, order: PurchaseOrder):
    order.received_at = now()
    items = _items(db, order)
    for it in items:
        if it.status in ("ordered", "in_transit"):
            inv.transition(it, "received")
    for l in order.lines:
        l.received_quantity = l.quantity
    events.log(db, "purchase_received", f"Commande #{order.id} réceptionnée : {len(items)} article(s) en stock",
               entity="purchase_order", entity_id=order.id)
    events.notify(db, "item_received", f"Commande #{order.id} réceptionnée", f"{len(items)} article(s) à photographier et publier",
                  severity="success", link="/stock", dedupe_key=f"po-received-{order.id}")
    from . import agents
    agents.publish(db, "purchase_manager", "inventory_manager", "order_received",
                   {"order_id": order.id, "items": len(items)}, dedupe_key=f"order-received-{order.id}")


def _cancel(db: Session, order: PurchaseOrder):
    if order.status in ("ordered", "shipped"):
        items = _items(db, order)
        if any(i.status not in ("ordered", "in_transit") for i in items):
            raise PurchaseError("Des articles de cette commande sont déjà reçus : annulation impossible.")
        for it in items:
            db.delete(it)
        for e in db.query(Expense).filter(Expense.purchase_order_id == order.id, Expense.voided_at.is_(None)).all():
            e.voided_at = now()
        events.log(db, "purchase_cancelled", f"Commande #{order.id} annulée : dépense annulée (écriture conservée, marquée annulée)",
                   entity="purchase_order", entity_id=order.id)


def _budget_alert(db: Session):
    b = budget_status(db)
    if b["monthly_budget"] > 0:
        used = (b["monthly_spent"] + b["committed"]) / b["monthly_budget"]
        if used >= Decimal("0.8"):
            ym = now().strftime("%Y-%m")
            events.notify(db, "budget_near", "Budget mensuel presque atteint",
                          f"{q2(used * 100)} % du budget mensuel est engagé ({b['monthly_spent']} € dépensés + {b['committed']} € engagés).",
                          severity="warning", link="/finance", dedupe_key=f"budget80-{ym}")
