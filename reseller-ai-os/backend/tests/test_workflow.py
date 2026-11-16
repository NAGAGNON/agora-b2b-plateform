"""Achats → stock → annonces → ventes → finance, au niveau services (règles métier et comptabilité)."""
from decimal import Decimal as D
import pytest
from app.models import Expense, InventoryItem, Notification, Supplier
from app.services import finance, inventory as inv, purchasing as pur, sales, settings as S
from app.services.inventory import InvalidTransition


def make_order(db, status="awaiting_validation", price="10.00", qty=2, ship="3.00"):
    sup = Supplier(name=f"F{db.query(Supplier).count()}")
    db.add(sup); db.flush()
    o = pur.create_order(db, supplier_id=sup.id, lines=[{"name": "Robe", "unit_price": price, "quantity": qty, "category": "Robes"}],
                         shipping_cost=ship, status=status)
    return o


def receive_order(db, **kw):
    o = make_order(db, **kw)
    pur.set_status(db, o, "validated")
    pur.set_status(db, o, "ordered")
    pur.set_status(db, o, "received")
    return o


def test_cannot_order_without_user_validation(db):
    o = make_order(db)
    with pytest.raises(pur.PurchaseError):
        pur.set_status(db, o, "ordered")  # saut interdit
    with pytest.raises(pur.PurchaseError):
        pur.set_status(db, o, "validated", actor="ai")  # l'IA ne valide pas


def test_order_records_expense_and_creates_unreceived_items(db):
    o = make_order(db)
    pur.set_status(db, o, "validated")
    assert db.query(Expense).count() == 0  # rien n'est comptabilisé avant la commande effective
    pur.set_status(db, o, "ordered")
    exp = db.query(Expense).one()
    assert exp.amount == D("23.00") and exp.category == "achats_fournisseurs" and exp.purchase_order_id == o.id
    items = db.query(InventoryItem).order_by(InventoryItem.id).all()
    assert len(items) == 2 and {i.status for i in items} == {"ordered"}
    assert sum(i.unit_cost for i in items) == D("23.00")  # frais répartis exactement
    assert not any(inv.is_in_stock(i) for i in items)  # un article commandé n'est PAS en stock


def test_receive_updates_stock_and_cancel_rules(db):
    o = receive_order(db)
    items = db.query(InventoryItem).all()
    assert all(inv.is_in_stock(i) for i in items) and all(i.received_at for i in items)
    with pytest.raises(pur.PurchaseError):
        pur.set_status(db, o, "cancelled")  # transitions reçue→annulée interdite


def test_cancel_after_order_voids_expense_and_removes_items(db):
    o = make_order(db)
    pur.set_status(db, o, "validated"); pur.set_status(db, o, "ordered")
    pur.set_status(db, o, "cancelled")
    assert db.query(InventoryItem).count() == 0
    e = db.query(Expense).one()
    assert e.voided_at is not None
    assert finance.cash(db)["total_out"] == D("0.00")


def test_budget_blocks_validation_unless_forced(db):
    S.set_many(db, {"budget_monthly": 20})
    o = make_order(db)  # 23 €
    with pytest.raises(pur.PurchaseError, match="Budget"):
        pur.set_status(db, o, "validated")
    pur.set_status(db, o, "validated", override_budget=True)
    assert o.approved_at is not None
    S.set_many(db, {"budget_monthly": 0, "budget_per_purchase": 10})
    o2 = make_order(db)
    with pytest.raises(pur.PurchaseError, match="budget par achat"):
        pur.set_status(db, o2, "validated")


def test_inventory_transitions_and_unavailable_items(db):
    o = make_order(db)
    pur.set_status(db, o, "validated"); pur.set_status(db, o, "ordered")
    item = db.query(InventoryItem).first()
    with pytest.raises(InvalidTransition):
        inv.transition(item, "published")  # non reçu → pas publiable
    with pytest.raises(sales.SaleError, match="indisponible"):
        sales.create_sale(db, item_id=item.id, sale_price=20)


def test_sale_flow_figures_and_side_effects(db):
    receive_order(db)
    item = db.query(InventoryItem).first()
    inv.transition(item, "published")
    s = sales.create_sale(db, item_id=item.id, sale_price="29.00", shipping_cost="0", packaging_cost="0.30")
    assert item.status == "sold" and not inv.is_in_stock(item)
    assert s.shipment and s.shipment.deadline > s.sold_at  # tâche d'expédition créée
    assert db.query(Notification).filter(Notification.kind == "sale_made").count() == 1
    f = sales.figures(s)
    assert f["revenue"] == D("29.00") and f["item_cost"] == D("11.50") and f["profit"] == D("17.20")  # 29-11.50-0.30
    with pytest.raises(sales.SaleError):
        sales.create_sale(db, item_id=item.id, sale_price=29)  # déjà vendu
    with pytest.raises(sales.SaleError, match="livré"):
        sales.record_payout(db, s)
    sales.set_status(db, s, "payment_confirmed")
    assert s.status == "to_ship"
    sales.set_status(db, s, "shipped", tracking="XX123", carrier="Mondial Relay")
    assert item.status == "shipped" and s.shipment.tracking_number == "XX123"
    sales.set_status(db, s, "delivered")
    with pytest.raises(sales.SaleError, match="versement"):
        sales.set_status(db, s, "completed")
    sales.record_payout(db, s)
    sales.set_status(db, s, "completed")
    assert item.status == "done" and s.payment_status == "paid_out"


def test_finance_revenue_is_not_profit_and_cash_is_exact(db):
    S.set_many(db, {"initial_capital": 100})
    receive_order(db)  # 23 € dépensés
    a, b = db.query(InventoryItem).order_by(InventoryItem.id).all()
    inv.transition(a, "published")
    s = sales.create_sale(db, item_id=a.id, sale_price="30.00", packaging_cost="0")
    d = finance.dashboard(db)
    assert d["revenue_month"] == D("30.00")
    assert d["net_profit_month"] == D("18.50")  # 30 - 11.50 (coût de l'article vendu, pas des 23 € d'achat)
    assert d["invested_purchases"] == D("23.00") and d["stock_value"] == D("11.50")
    assert d["pending_payouts"] == D("30.00") and d["cashed_in"] == D("0.00")
    assert d["cash_available"] == D("77.00")  # 100 - 23, rien encaissé
    sales.set_status(db, s, "payment_confirmed"); sales.set_status(db, s, "shipped"); sales.set_status(db, s, "delivered")
    sales.record_payout(db, s)
    c = finance.cash(db)
    assert c["cash_available"] == D("107.00") and c["pending_payouts"] == D("0.00") and c["cashed_in"] == D("30.00")


def test_operating_expenses_reduce_profit_not_revenue(db):
    receive_order(db)
    a = db.query(InventoryItem).first()
    sales.create_sale(db, item_id=a.id, sale_price="30.00", packaging_cost="0")
    db.add(Expense(category="abonnement", amount=D("5.00"), description="Outil")); db.flush()
    d = finance.dashboard(db)
    assert d["revenue_month"] == D("30.00") and d["net_profit_month"] == D("13.50")


def test_refund_with_and_without_restock(db):
    receive_order(db)
    a, b = db.query(InventoryItem).order_by(InventoryItem.id).all()
    s1 = sales.create_sale(db, item_id=a.id, sale_price="30.00", packaging_cost="0")
    sales.set_status(db, s1, "to_ship"); sales.set_status(db, s1, "shipped")
    sales.set_status(db, s1, "refunded", restock=True)
    f = sales.figures(s1)
    assert f["revenue"] == D("0.00") and f["profit"] == D("0.00") and a.status == "returned" and inv.is_in_stock(a)
    s2 = sales.create_sale(db, item_id=b.id, sale_price="30.00", packaging_cost="0")
    sales.set_status(db, s2, "to_ship"); sales.set_status(db, s2, "shipped")
    sales.set_status(db, s2, "refunded", restock=False, refund_amount="30.00")
    assert sales.figures(s2)["profit"] == D("-11.50")  # perte sèche : article non récupéré


def test_cancel_before_shipping_restores_stock(db):
    receive_order(db)
    a = db.query(InventoryItem).first()
    s = sales.create_sale(db, item_id=a.id, sale_price="30.00", shipping_cost="4.00", packaging_cost="0")
    assert db.query(Expense).filter(Expense.sale_id == s.id).count() == 1
    sales.set_status(db, s, "cancelled")
    assert inv.is_in_stock(a) and sales.figures(s)["revenue"] == D("0.00")
    assert db.query(Expense).filter(Expense.sale_id == s.id).count() == 0


def test_month_report_separates_cash_and_profit(db):
    from app.core import timez
    from app.models import now
    receive_order(db)
    a = db.query(InventoryItem).first()
    sales.create_sale(db, item_id=a.id, sale_price="30.00", packaging_cost="0")
    n = timez.local(now())
    r = finance.month_report(db, n.year, n.month)
    assert r["revenue"] == D("30.00") and r["purchases"] == D("23.00") and r["estimated_profit"] == D("18.50")
    assert r["cash_result"] == D("7.00") and r["stock_value_now"] == D("11.50")
