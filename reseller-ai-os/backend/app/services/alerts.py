"""Alertes calculées à la volée depuis les données réelles."""
from datetime import timedelta
from decimal import Decimal
from statistics import median
from sqlalchemy.orm import Session
from ..core.money import D, q2
from ..models import Expense, InventoryItem, Opportunity, PurchaseLine, PurchaseOrder, Sale, VintedIncident, now
from . import inventory as inv, sales as sales_svc, settings as S


def compute(db: Session) -> list[dict]:
    cfg = S.get_all(db)
    out: list[dict] = []
    n = now()

    unpub = inv.unpublished_after_reception(db, int(cfg["unpublished_alert_days"]))
    if unpub:
        out.append({"kind": "unpublished", "severity": "warning", "count": len(unpub), "link": "/stock?status=received",
                    "title": f"{len(unpub)} produit(s) reçu(s) non publié(s)",
                    "detail": f"Reçus depuis plus de {cfg['unpublished_alert_days']} jours : " + ", ".join(i.name for i in unpub[:3])})

    to_ship = (db.query(Sale).filter(Sale.status.in_(["detected", "payment_pending", "payment_confirmed", "to_ship"])).all())
    if to_ship:
        out.append({"kind": "to_ship", "severity": "info", "count": len(to_ship), "link": "/expeditions",
                    "title": f"{len(to_ship)} commande(s) à expédier", "detail": ", ".join(s.item.name for s in to_ship[:3])})
    late = [s for s in to_ship if s.shipment and s.shipment.deadline and s.shipment.deadline < n]
    if late:
        out.append({"kind": "late_shipping", "severity": "danger", "count": len(late), "link": "/expeditions",
                    "title": f"{len(late)} retard(s) d'expédition", "detail": "Date limite dépassée : " + ", ".join(s.item.name for s in late[:3])})

    oos = (db.query(Opportunity).filter(Opportunity.availability == "out_of_stock", Opportunity.status.in_(["recommended", "validated", "to_study"])).all())
    open_lines = (db.query(PurchaseLine).join(PurchaseOrder).join(Opportunity, PurchaseLine.opportunity_id == Opportunity.id)
                  .filter(PurchaseOrder.status.in_(["to_study", "recommended", "awaiting_validation", "validated"]),
                          Opportunity.availability == "out_of_stock").all())
    if oos or open_lines:
        out.append({"kind": "stockout", "severity": "warning", "count": len(oos) + len(open_lines), "link": "/opportunites?availability=out_of_stock",
                    "title": f"{len(oos)} produit(s) en rupture chez le fournisseur",
                    "detail": f"{len(open_lines)} ligne(s) d'achat en cours concernée(s)" if open_lines else "Opportunités à écarter ou à re-vérifier"})

    refunds = db.query(Sale).filter(Sale.status == "refunded").count()
    open_inc = db.query(VintedIncident).filter(VintedIncident.status == "open").count()
    if refunds or open_inc:
        out.append({"kind": "returns", "severity": "danger", "count": refunds + open_inc, "link": "/vinted",
                    "title": f"{refunds} remboursement(s), {open_inc} incident(s) ouvert(s)", "detail": "À traiter dans le module Vinted"})

    losing = []
    for s in db.query(Sale).filter(Sale.status != "cancelled").order_by(Sale.sold_at.desc()).limit(200).all():
        if sales_svc.figures(s)["profit"] < 0:
            losing.append(s)
    if losing:
        out.append({"kind": "unprofitable", "severity": "warning", "count": len(losing), "link": "/ventes",
                    "title": f"{len(losing)} vente(s) non rentable(s)", "detail": ", ".join(s.item.name for s in losing[:3])})
    low_listed = []
    for it in db.query(InventoryItem).filter(InventoryItem.status == "published").all():
        if it.listing_price is not None and D(it.listing_price) <= D(it.unit_cost) + D(it.extra_cost):
            low_listed.append(it)
    if low_listed:
        out.append({"kind": "unprofitable_listing", "severity": "warning", "count": len(low_listed), "link": "/stock?status=published",
                    "title": f"{len(low_listed)} annonce(s) sous le seuil de rentabilité", "detail": ", ".join(i.name for i in low_listed[:3])})

    factor = D(cfg["unusual_expense_factor"])
    by_cat: dict[str, list] = {}
    for e in db.query(Expense).filter(Expense.voided_at.is_(None), Expense.purchase_order_id.is_(None), Expense.sale_id.is_(None)).all():
        by_cat.setdefault(e.category, []).append(e)
    unusual = []
    for cat, rows in by_cat.items():
        if len(rows) >= 5:
            med = median([D(r.amount) for r in rows])
            unusual += [r for r in rows if med > 0 and D(r.amount) > med * factor and (n - r.date) < timedelta(days=30)]
    if unusual:
        out.append({"kind": "unusual_expense", "severity": "warning", "count": len(unusual), "link": "/finance",
                    "title": f"{len(unusual)} dépense(s) inhabituelle(s)", "detail": ", ".join(f"{e.description or e.category} ({e.amount} €)" for e in unusual[:3])})

    thr = int(cfg["excellent_score"])
    good = db.query(Opportunity).filter(Opportunity.status.in_(["new", "to_study", "recommended"]), Opportunity.score >= thr,
                                        Opportunity.availability != "out_of_stock").count()
    if good:
        out.append({"kind": "opportunities", "severity": "success", "count": good, "link": "/opportunites?min_score=%d" % thr,
                    "title": f"{good} opportunité(s) intéressante(s) (score ≥ {thr})", "detail": "À valider ou à acheter"})
    pend = db.query(PurchaseOrder).filter(PurchaseOrder.status == "awaiting_validation").count()
    if pend:
        out.append({"kind": "awaiting_validation", "severity": "info", "count": pend, "link": "/achats?status=awaiting_validation",
                    "title": f"{pend} achat(s) en attente de votre validation", "detail": "Aucun paiement n'est effectué sans votre accord"})
    return out
