from decimal import Decimal as D
import pytest
from app.core import profit as P, scoring
from app.core.allocation import unit_costs
from app.core.money import q2, pct


def test_spec_example_exact():
    # Achat 12 €, revente 29 €, coûts supplémentaires 4 € → bénéfice 13 €, marge 44,8 %
    cost = P.total_cost(12, 0, 0, 0, 4)
    assert cost == D("16.00")
    profit = P.net_profit(29, cost)
    assert profit == D("13.00")
    assert P.margin_pct(profit, 29) == D("44.8")


def test_cost_chain_and_fees():
    cost = P.total_cost("10.10", "1.25", "0.30", "0.10", "0.25")
    assert cost == D("12.00")
    assert P.seller_fees(30, 5, "0.70") == D("2.20")
    assert P.net_profit(30, cost, "2.20", "1.00") == D("14.80")
    assert P.gross_profit(30, "10.10", "1.25") == D("18.65")


def test_rounding_half_up_and_no_float_drift():
    assert q2("0.005") == D("0.01")
    assert q2(0.1 + 0.2) == D("0.30")
    assert pct(1, 3) == D("33.3")
    assert pct(1, 0) is None


def test_break_even_and_target_price():
    be = P.break_even_price(16, 10)  # prix tel que prix*0.9 = 16
    assert be == D("17.78")
    assert P.net_profit(be, 16, P.seller_fees(be, 10)) >= D("-0.01")
    p = P.price_for_target_margin(16, 30)  # 16 / 0.7
    assert p == D("22.86")
    assert P.margin_pct(P.net_profit(p, 16), p) >= D("30.0")


def test_simulator_verdicts():
    ok = P.simulate(purchase_price=12, resale_price=29, other=4, min_margin_pct=30, min_profit=5)
    assert ok["verdict"] == "go" and ok["unit"]["net_profit"] == D("13.00")
    bad = P.simulate(purchase_price=12, resale_price=17, other=4, min_margin_pct=30, min_profit=5)
    assert bad["verdict"] == "no_go"
    budget = P.simulate(purchase_price=12, resale_price=29, quantity=10, budget_remaining=100)
    assert budget["total"]["capital_required"] == D("120.00") and budget["verdict"] == "no_go"
    with pytest.raises(ValueError):
        P.simulate(purchase_price=1, resale_price=2, quantity=0)


def test_allocation_is_exact_to_the_cent():
    lines = [{"unit_price": "3.33", "quantity": 3}, {"unit_price": "7.10", "quantity": 2}]
    costs = unit_costs(lines, "5.00")
    total = sum(sum(c) for c in costs)
    assert total == D("3.33") * 3 + D("7.10") * 2 + D("5.00")
    assert [len(c) for c in costs] == [3, 2]
    # des frais impairs sont répartis sans perte d'un centime
    assert sum(unit_costs([{"unit_price": "1.00", "quantity": 3}], "0.10")[0]) == D("3.10")


def test_score_requires_resale_price():
    r = scoring.score_opportunity(purchase_price=10, resale_price=None)
    assert r["score"] is None and "prix de revente" in r["missing"]


def test_score_ranking_and_caps():
    good = scoring.score_opportunity(purchase_price=12, extra_costs=4, resale_price=29, n_evidence=3, basis="ventes observées",
                                     demand="high", competition="low", risk="low", compliance="ok", min_margin=20, min_profit=5)
    meh = scoring.score_opportunity(purchase_price=12, extra_costs=4, resale_price=22, n_evidence=0, basis="estimation manuelle")
    loss = scoring.score_opportunity(purchase_price=20, resale_price=15, demand="high", competition="low", risk="low")
    assert good["score"] > meh["score"] > loss["score"]
    assert good["verdict"] == "recommandé" and good["confidence"] > meh["confidence"]
    assert loss["score"] <= 20 and loss["verdict"] == "à écarter"
    forbidden = scoring.score_opportunity(purchase_price=1, resale_price=50, compliance="forbidden")
    assert forbidden["score"] == 0 and forbidden["blocked"]


def test_resale_resolution_prefers_observed_sales():
    price, basis, n = scoring.resolve_resale([{"price": 20, "kind": "sold"}, {"price": 30, "kind": "sold"}, {"price": 99, "kind": "listed"}], 50)
    assert (price, basis, n) == (D("25.00"), "ventes observées", 2)
    assert scoring.resolve_resale([], None)[0] is None
