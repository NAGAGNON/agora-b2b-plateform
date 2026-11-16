"""Score d'opportunité /100, déterministe et explicable. Aucune donnée n'est inventée :
sans prix de revente, il n'y a pas de score (« donnée manquante »)."""
from decimal import Decimal
from statistics import median
from .money import D, q2
from . import profit as P

LEVEL_PTS = {"high": 100, "medium": 60, "low": 20, None: 40, "unknown": 40}
INV_LEVEL_PTS = {"low": 100, "medium": 60, "high": 20, None: 40, "unknown": 40}  # concurrence / risque : bas = bon
WEIGHTS = {"margin": 40, "profit": 20, "demand": 15, "competition": 10, "risk": 10, "evidence": 5}


def resolve_resale(references: list[dict], manual_price) -> tuple[Decimal | None, str, int]:
    """Prix de revente retenu : médiane des ventes observées > médiane des annonces observées > estimation manuelle."""
    sold = [D(r["price"]) for r in references if r.get("kind") == "sold"]
    listed = [D(r["price"]) for r in references if r.get("kind") == "listed"]
    if sold:
        return q2(median(sold)), "ventes observées", len(sold)
    if listed:
        return q2(median(listed)), "annonces observées", len(listed)
    if manual_price is not None and D(manual_price) > 0:
        return q2(manual_price), "estimation manuelle", 0
    return None, "aucun", 0


def score_opportunity(*, purchase_price, supplier_shipping=0, extra_costs=0, resale_price, n_evidence=0,
                      basis="aucun", demand=None, competition=None, risk=None, compliance="unknown",
                      min_margin=None, min_profit=None) -> dict:
    missing = []
    if resale_price is None:
        return {"score": None, "profit": None, "margin_pct": None, "total_cost": None, "confidence": 0,
                "missing": ["prix de revente"], "breakdown": {}, "verdict": "donnée manquante", "blocked": False}
    cost = P.total_cost(purchase_price, supplier_shipping, 0, 0, extra_costs)
    profit = P.net_profit(resale_price, cost)
    margin = P.margin_pct(profit, resale_price) or Decimal("0")

    m_pts = max(0, min(100, float(margin) / 50 * 100)) if profit > 0 else 0
    p_pts = max(0, min(100, float(profit) / 15 * 100)) if profit > 0 else 0
    d_pts = LEVEL_PTS.get(demand, 40)
    c_pts = INV_LEVEL_PTS.get(competition, 40)
    eff_risk = risk
    if compliance == "review" and risk in (None, "low", "unknown"):
        eff_risk = "medium"
    r_pts = INV_LEVEL_PTS.get(eff_risk, 40)
    e_pts = min(100, n_evidence * 34)
    parts = {"margin": m_pts, "profit": p_pts, "demand": d_pts, "competition": c_pts, "risk": r_pts, "evidence": e_pts}
    score = sum(parts[k] * WEIGHTS[k] / 100 for k in parts)
    if profit <= 0:
        score = min(score, 20)
    blocked = compliance == "forbidden"
    if blocked:
        score = 0
    for k, v in (("demande", demand), ("concurrence", competition), ("risque", risk)):
        if v in (None, "unknown"):
            missing.append(k)
    # confiance : qualité de la source du prix + complétude
    base = {"ventes observées": 60, "annonces observées": 45, "estimation manuelle": 25}.get(basis, 0)
    base += min(n_evidence, 5) * 4
    base += 5 * (3 - len(missing)) if len(missing) <= 3 else 0
    confidence = max(0, min(100, base))
    verdict = "à écarter" if blocked or profit <= 0 else "à étudier"
    if not blocked and profit > 0:
        ok_m = min_margin is None or margin >= D(min_margin)
        ok_p = min_profit is None or profit >= D(min_profit)
        verdict = "recommandé" if ok_m and ok_p and score >= 60 else "à étudier"
    return {"score": int(round(score)), "profit": profit, "margin_pct": margin, "total_cost": cost,
            "confidence": int(confidence), "missing": missing,
            "breakdown": {k: round(parts[k] * WEIGHTS[k] / 100, 1) for k in parts}, "verdict": verdict, "blocked": blocked}
