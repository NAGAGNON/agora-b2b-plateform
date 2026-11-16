"""Répartition exacte (au centime) des frais de commande sur les lignes puis sur les unités."""
from decimal import Decimal
from .money import D, to_cents, from_cents


def _largest_remainder(total_cents: int, weights: list[int]) -> list[int]:
    wsum = sum(weights)
    n = len(weights)
    if n == 0:
        return []
    if wsum <= 0:
        weights = [1] * n
        wsum = n
    raw = [total_cents * w / wsum for w in weights]
    base = [int(r // 1) for r in raw]
    rest = total_cents - sum(base)
    order = sorted(range(n), key=lambda i: (raw[i] - base[i]), reverse=True)
    for i in order[: max(rest, 0)]:
        base[i] += 1
    return base


def unit_costs(lines: list[dict], order_fees) -> list[list[Decimal]]:
    """lines: [{'unit_price': x, 'quantity': n}]. Les frais de commande (livraison, autres)
    sont répartis proportionnellement à la valeur des lignes ; la somme des coûts unitaires
    est exactement égale au total de la commande."""
    line_totals = [to_cents(D(l["unit_price"])) * int(l["quantity"]) for l in lines]
    fee_cents = to_cents(order_fees)
    fee_by_line = _largest_remainder(fee_cents, line_totals)
    result = []
    for line, lt, fee in zip(lines, line_totals, fee_by_line):
        qty = int(line["quantity"])
        total_line = lt + fee
        per_unit = _largest_remainder(total_line, [1] * qty)
        result.append([from_cents(c) for c in per_unit])
    return result
