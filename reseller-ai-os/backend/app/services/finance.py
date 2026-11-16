"""Finance : P&L, trésorerie, séries mensuelles. Calcul pur SQL/Python, aucun appel IA.

Principes :
- Chiffre d'affaires ≠ bénéfice. CA = prix de vente − remboursements (ventes non annulées, à la date de vente).
- Les achats de stock sont CAPITALISÉS : ils sortent de la trésorerie mais ne deviennent une charge
  (coût des marchandises vendues) qu'à la vente de l'article.
- Bénéfice net (période) = CA − coût des articles vendus − frais vendeur − expédition/emballage des ventes − charges d'exploitation.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..core.money import D, q2, pct
from ..core import timez
from ..models import Expense, InventoryItem, PurchaseOrder, Sale, now
from . import inventory as inv, purchasing, sales as sales_svc, settings as S

CATEGORIES = {
    "achats_fournisseurs": "Achats fournisseurs", "expedition": "Frais d'expédition", "emballage": "Emballages",
    "frais_operationnels": "Frais opérationnels", "abonnement": "Abonnements", "retour": "Retours",
    "remboursement": "Remboursements", "autre": "Autres dépenses",
}


def _sales_between(db: Session, start: datetime, end: datetime):
    return (db.query(Sale).filter(Sale.sold_at >= start, Sale.sold_at < end, Sale.status != "cancelled").all())


def _opex(db: Session, start: datetime, end: datetime) -> Decimal:
    v = (db.query(func.coalesce(func.sum(Expense.amount), 0))
         .filter(Expense.date >= start, Expense.date < end, Expense.voided_at.is_(None),
                 Expense.purchase_order_id.is_(None), Expense.sale_id.is_(None)).scalar())
    return q2(v)


def pnl(db: Session, start: datetime, end: datetime) -> dict:
    rows = _sales_between(db, start, end)
    revenue = cogs = fees = ship = pack = Decimal("0")
    for s in rows:
        f = sales_svc.figures(s)
        revenue += f["revenue"]; cogs += f["item_cost"]; fees += f["fees"]; ship += f["shipping_cost"]; pack += f["packaging_cost"]
    gross = revenue - cogs
    opex = _opex(db, start, end)
    net = gross - fees - ship - pack - opex
    return {"sales_count": len(rows), "revenue": q2(revenue), "cogs": q2(cogs), "gross_profit": q2(gross),
            "seller_fees": q2(fees), "shipping_costs": q2(ship), "packaging_costs": q2(pack), "operating_expenses": q2(opex),
            "net_profit": q2(net), "margin_pct": pct(net, revenue)}


def cash(db: Session) -> dict:
    cfg = S.get_all(db)
    initial = q2(cfg["initial_capital"])
    cash_in = Decimal("0")
    pending = Decimal("0")
    for s in db.query(Sale).filter(Sale.status != "cancelled").all():
        f = sales_svc.figures(s)
        if s.payout_received_at is not None:
            cash_in += f["payout"]
        elif s.status != "refunded":
            pending += f["payout"]
    cash_out = q2(db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.voided_at.is_(None)).scalar())
    purchases = q2(db.query(func.coalesce(func.sum(Expense.amount), 0))
                   .filter(Expense.voided_at.is_(None), Expense.purchase_order_id.isnot(None)).scalar())
    in_hand = Decimal("0"); in_orders = Decimal("0"); in_stock_count = 0
    for it in db.query(InventoryItem).filter(InventoryItem.status.in_(list(inv.IN_STOCK | {"ordered", "in_transit"}))).all():
        c = D(it.unit_cost) + D(it.extra_cost)
        if it.status in ("ordered", "in_transit"):
            in_orders += c
        else:
            in_hand += c
            in_stock_count += 1
    committed = purchasing.committed(db)
    available = q2(initial + cash_in - cash_out)
    return {"initial_capital": initial, "cash_available": available, "cashed_in": q2(cash_in), "pending_payouts": q2(pending),
            "total_out": cash_out, "invested_purchases": purchases, "stock_value": q2(in_hand), "in_transit_value": q2(in_orders),
            "upcoming_expenses": committed, "capital_for_purchases": q2(available - committed), "items_in_stock": in_stock_count}


def dashboard(db: Session) -> dict:
    n = now()
    d0, w0, m0 = timez.start_of_day(n), timez.start_of_week(n), timez.start_of_month(n)
    far = n + timedelta(days=1)
    ly = timez.local(n)
    all_time = pnl(db, datetime(2000, 1, 1, tzinfo=n.tzinfo), far)
    today, week, month = pnl(db, d0, far), pnl(db, w0, far), pnl(db, m0, far)
    c = cash(db)
    total_expenses = q2(db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.voided_at.is_(None)).scalar())
    operating_total = _opex(db, datetime(2000, 1, 1, tzinfo=n.tzinfo), far)
    to_ship = db.query(Sale).filter(Sale.status.in_(["detected", "payment_pending", "payment_confirmed", "to_ship"])).count()
    open_sales = db.query(Sale).filter(Sale.status.in_(list(sales_svc.ACTIVE))).count()
    po_open = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["ordered", "shipped"])).count()
    return {
        "revenue_today": today["revenue"], "revenue_week": week["revenue"], "revenue_month": month["revenue"],
        "net_profit_month": month["net_profit"], "net_profit_total": all_time["net_profit"],
        "total_expenses": total_expenses, "operating_expenses_total": operating_total,
        "invested_purchases": c["invested_purchases"], "stock_value": c["stock_value"], "in_transit_value": c["in_transit_value"],
        "pending_payouts": c["pending_payouts"], "cashed_in": c["cashed_in"], "cash_available": c["cash_available"],
        "capital_for_purchases": c["capital_for_purchases"],
        "sales_count": all_time["sales_count"], "sales_count_month": month["sales_count"],
        "orders_in_progress": {"sales_open": open_sales, "sales_to_ship": to_ship, "purchase_orders": po_open},
        "items_in_stock": c["items_in_stock"], "month_label": f"{ly.month:02d}/{ly.year}",
    }


def series(db: Session, months: int = 12) -> list[dict]:
    n = timez.local(now())
    keys = []
    y, m = n.year, n.month
    for i in range(months - 1, -1, -1):
        keys.append(timez.add_months(y, m, -i))
    start = timez.month_start(*keys[0])
    end = timez.month_start(*timez.next_month(*keys[-1]))
    agg = {f"{k[0]}-{k[1]:02d}": defaultdict(lambda: Decimal("0")) for k in keys}
    for s in _sales_between(db, start, end):
        f = sales_svc.figures(s)
        a = agg[timez.month_key(s.sold_at)]
        a["revenue"] += f["revenue"]
        a["sale_profit"] += f["profit"]
        a["count"] += 1
    for e in db.query(Expense).filter(Expense.date >= start, Expense.date < end, Expense.voided_at.is_(None)).all():
        a = agg[timez.month_key(e.date)]
        a["expenses"] += D(e.amount)
        if e.purchase_order_id:
            a["purchases"] += D(e.amount)
        elif not e.sale_id:
            a["opex"] += D(e.amount)
    out = []
    for k in keys:
        key = f"{k[0]}-{k[1]:02d}"
        a = agg[key]
        net = a["sale_profit"] - a["opex"]
        out.append({"month": key, "revenue": q2(a["revenue"]), "net_profit": q2(net), "expenses": q2(a["expenses"]),
                    "purchases": q2(a["purchases"]), "sales": int(a["count"]),
                    "avg_margin_pct": pct(a["sale_profit"], a["revenue"])})
    return out


def sales_by_category(db: Session, months: int = 12) -> list[dict]:
    start = timez.month_start(*timez.add_months(timez.local(now()).year, timez.local(now()).month, -(months - 1)))
    acc: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for s in _sales_between(db, start, now() + timedelta(days=1)):
        acc[(s.item.category or "Sans catégorie")] += sales_svc.figures(s)["revenue"]
    return sorted(({"category": k, "revenue": q2(v)} for k, v in acc.items()), key=lambda r: -r["revenue"])


def month_report(db: Session, year: int, month: int) -> dict:
    start, end = timez.month_range(year, month)
    p = pnl(db, start, end)
    purchases = purchasing.purchases_spent(db, start, end)
    sale_costs = q2(p["shipping_costs"] + p["packaging_costs"])
    other = q2(p["operating_expenses"] + sale_costs)
    c = cash(db)
    pending_in_month = Decimal("0")
    for s in _sales_between(db, start, end):
        if s.payout_received_at is None and s.status != "refunded":
            pending_in_month += sales_svc.figures(s)["payout"]
    return {"year": year, "month": month, "revenue": p["revenue"], "purchases": purchases, "other_expenses": other,
            "estimated_profit": p["net_profit"], "pnl": p, "stock_value_now": c["stock_value"],
            "pending_payouts_month": q2(pending_in_month), "pending_payouts_total": c["pending_payouts"],
            "cash_result": q2(p["revenue"] - purchases - other),
            "note": ("Le bénéfice estimé compte le coût des seuls articles vendus ; le résultat de caisse "
                     "(CA − achats − autres dépenses) inclut aussi les achats encore en stock.")}


def expenses_breakdown(db: Session, start: datetime, end: datetime) -> list[dict]:
    rows = (db.query(Expense.category, func.sum(Expense.amount)).filter(Expense.date >= start, Expense.date < end, Expense.voided_at.is_(None))
            .group_by(Expense.category).all())
    return [{"category": c, "label": CATEGORIES.get(c, c), "amount": q2(a)} for c, a in rows]


def profit_by_product(db: Session, limit=50) -> list[dict]:
    out = []
    for s in db.query(Sale).filter(Sale.status != "cancelled").order_by(Sale.sold_at.desc()).limit(limit).all():
        f = sales_svc.figures(s)
        out.append({"sale_id": s.id, "item_id": s.item_id, "name": s.item.name, "sold_at": s.sold_at, "revenue": f["revenue"],
                    "cost": f["item_cost"], "profit": f["profit"], "margin_pct": f["margin_pct"]})
    return out
