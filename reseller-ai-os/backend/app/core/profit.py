"""Moteur de rentabilité — code classique, aucun appel IA.

Définitions (documentées aussi dans l'interface) :
  coût total        = prix d'achat + livraison fournisseur + emballage + frais opérationnels + autres coûts
  bénéfice brut     = prix de vente encaissé − (prix d'achat + livraison fournisseur)      [marchandise seule]
  bénéfice net      = prix de vente encaissé − coût total − frais vendeur − remboursements/pertes
  marge commerciale = bénéfice net / prix de vente × 100
"""
from dataclasses import dataclass, asdict
from decimal import Decimal
from .money import D, q2, pct


@dataclass
class CostInputs:
    purchase_price: Decimal = Decimal("0")
    supplier_shipping: Decimal = Decimal("0")
    packaging: Decimal = Decimal("0")
    operating: Decimal = Decimal("0")
    other: Decimal = Decimal("0")

    def total(self) -> Decimal:
        return q2(self.purchase_price + self.supplier_shipping + self.packaging + self.operating + self.other)


def total_cost(purchase_price, supplier_shipping=0, packaging=0, operating=0, other=0) -> Decimal:
    return CostInputs(D(purchase_price), D(supplier_shipping), D(packaging), D(operating), D(other)).total()


def net_profit(sale_price, cost_total, seller_fees=0, refunds_losses=0) -> Decimal:
    return q2(D(sale_price) - D(cost_total) - D(seller_fees) - D(refunds_losses))


def gross_profit(sale_price, purchase_price, supplier_shipping=0) -> Decimal:
    return q2(D(sale_price) - D(purchase_price) - D(supplier_shipping))


def margin_pct(profit, sale_price) -> Decimal | None:
    return pct(profit, sale_price)


def seller_fees(sale_price, rate_pct=0, fixed=0) -> Decimal:
    return q2(D(sale_price) * D(rate_pct) / 100 + D(fixed))


def break_even_price(cost_total, fee_rate_pct=0, fixed_fee=0) -> Decimal:
    """Prix minimal pour un bénéfice nul."""
    denom = 1 - D(fee_rate_pct) / 100
    if denom <= 0:
        raise ValueError("Taux de frais ≥ 100 %")
    return q2((D(cost_total) + D(fixed_fee)) / denom)


def price_for_target_margin(cost_total, target_margin_pct, fee_rate_pct=0, fixed_fee=0) -> Decimal:
    denom = 1 - D(fee_rate_pct) / 100 - D(target_margin_pct) / 100
    if denom <= 0:
        raise ValueError("Marge cible + frais ≥ 100 %")
    return q2((D(cost_total) + D(fixed_fee)) / denom)


def simulate(*, purchase_price, resale_price, quantity=1, supplier_shipping=0, packaging=0, operating=0,
             other=0, fee_rate_pct=0, fixed_fee=0, refund_loss=0,
             min_margin_pct=None, min_profit=None, budget_remaining=None, per_purchase_budget=None) -> dict:
    """Simulateur avant achat. Tout est calculé par unité puis multiplié par la quantité."""
    qty = int(quantity)
    if qty < 1:
        raise ValueError("Quantité ≥ 1 requise")
    cost = total_cost(purchase_price, supplier_shipping, packaging, operating, other)
    fees = seller_fees(resale_price, fee_rate_pct, fixed_fee)
    profit = net_profit(resale_price, cost, fees, refund_loss)
    gross = gross_profit(resale_price, purchase_price, supplier_shipping)
    margin = margin_pct(profit, resale_price)
    roi = pct(profit, cost)
    out = {
        "unit": {
            "purchase_price": q2(purchase_price), "total_cost": cost, "seller_fees": fees,
            "gross_profit": gross, "net_profit": profit, "margin_pct": margin, "roi_pct": roi,
            "break_even_price": break_even_price(cost, fee_rate_pct, fixed_fee),
        },
        "total": {
            "quantity": qty, "capital_required": q2(cost * qty), "revenue": q2(D(resale_price) * qty),
            "net_profit": q2(profit * qty),
        },
        "checks": [],
    }
    checks = out["checks"]
    ok = True
    if min_margin_pct is not None:
        passed = margin is not None and margin >= D(min_margin_pct)
        checks.append({"key": "margin", "ok": passed, "label": f"Marge ≥ {D(min_margin_pct)} %"})
        ok &= passed
    if min_profit is not None:
        passed = profit >= D(min_profit)
        checks.append({"key": "profit", "ok": passed, "label": f"Bénéfice ≥ {q2(min_profit)} €"})
        ok &= passed
    if per_purchase_budget is not None and D(per_purchase_budget) > 0:
        passed = out["total"]["capital_required"] <= D(per_purchase_budget)
        checks.append({"key": "per_purchase_budget", "ok": passed, "label": f"Capital ≤ budget par achat ({q2(per_purchase_budget)} €)"})
        ok &= passed
    if budget_remaining is not None:
        passed = out["total"]["capital_required"] <= D(budget_remaining)
        checks.append({"key": "budget", "ok": passed, "label": f"Capital ≤ budget restant ({q2(budget_remaining)} €)"})
        ok &= passed
    out["verdict"] = "go" if ok and profit > 0 else "no_go"
    return out


def to_jsonable(d):
    return d
