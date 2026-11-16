"""Market Analyst + préparation de paniers. Notation 100 % déterministe ; l'IA n'est qu'un enrichissement optionnel et étiqueté."""
import json
from decimal import Decimal
from sqlalchemy.orm import Session
from ..core import scoring
from ..core.money import D, q2
from ..models import Opportunity, PurchaseLine, PurchaseOrder, Supplier, now
from . import agents, events, purchasing, settings as S

OPEN_PO = ["to_study", "recommended", "awaiting_validation", "validated", "ordered", "shipped"]


def analyze(db: Session, opp: Opportunity, cfg: dict | None = None) -> Opportunity:
    cfg = cfg or S.get_all(db)
    refs = [{"price": r.price, "kind": r.kind} for r in opp.references]
    resale, basis, n = scoring.resolve_resale(refs, opp.manual_resale_price)
    r = scoring.score_opportunity(
        purchase_price=opp.purchase_price, supplier_shipping=opp.shipping_cost, extra_costs=D(opp.extra_costs) + D(cfg["default_packaging"]) + D(cfg["default_operating"]),
        resale_price=resale, n_evidence=n, basis=basis, demand=opp.demand, competition=opp.competition, risk=opp.risk,
        compliance=opp.compliance, min_margin=cfg["min_margin_pct"], min_profit=cfg["min_profit"])
    # frais vendeur éventuels
    if resale is not None and (D(cfg["seller_fee_rate_pct"]) > 0 or D(cfg["seller_fee_fixed"]) > 0):
        from ..core import profit as P
        fees = P.seller_fees(resale, cfg["seller_fee_rate_pct"], cfg["seller_fee_fixed"])
        r["profit"] = q2(D(r["profit"]) - fees)
        r["margin_pct"] = P.margin_pct(r["profit"], resale)
    opp.resale_price, opp.resale_basis = resale, basis
    opp.est_profit, opp.est_margin_pct = r["profit"], r["margin_pct"]
    opp.score, opp.confidence = r["score"], r["confidence"]
    opp.score_detail = {"breakdown": r["breakdown"], "missing": r["missing"], "verdict": r["verdict"], "n_evidence": n,
                        "total_cost": str(r["total_cost"]) if r["total_cost"] is not None else None,
                        **({"ai": opp.score_detail["ai"]} if opp.score_detail and "ai" in opp.score_detail else {})}
    opp.analyzed_at = now()
    if opp.status in ("new", "to_study", "recommended"):
        # Un produit non rentable reste « à étudier » : c'est le Profit Manager qui l'écarte (passation entre agents)
        opp.status = "recommended" if (resale is not None and r["verdict"] == "recommandé") else "to_study"
        if opp.compliance == "forbidden":
            opp.status = "rejected"
    if resale is not None and r["profit"] is not None and r["profit"] <= 0 and opp.status == "to_study":
        agents.publish(db, "market_analyst", "profit_manager", "unprofitable_opportunity",
                       {"opportunity_id": opp.id, "reason": f"bénéfice estimé {r['profit']} €"}, dedupe_key=f"unprofitable-{opp.id}-{opp.resale_price}")
    if r["score"] is not None and r["score"] >= int(cfg["excellent_score"]) and opp.status == "recommended":
        events.notify(db, "excellent_opportunity", f"Excellente opportunité : {opp.name}",
                      f"Score {r['score']}/100 — bénéfice estimé {r['profit']} € ({r['margin_pct']} %)", severity="success",
                      link=f"/opportunites?id={opp.id}", dedupe_key=f"excellent-{opp.id}")
    return opp


def analyze_all(db: Session, only_unanalyzed=False) -> dict:
    cfg = S.get_all(db)
    q = db.query(Opportunity).filter(Opportunity.status.in_(["new", "to_study", "recommended"]))
    if only_unanalyzed:
        q = q.filter(Opportunity.analyzed_at.is_(None))
    n = 0
    for o in q.all():
        analyze(db, o, cfg)
        n += 1
    db.flush()
    scored = db.query(Opportunity).filter(Opportunity.score.isnot(None)).count()
    return {"analyzed": n, "scored_total": scored}


def ai_enrich(db: Session, opp: Opportunity) -> dict:
    """Estimation IA (étiquetée, jamais comptée comme prix observé). Cache + budget appliqués."""
    from . import ai
    system = ("Tu es analyste de revente sur Vinted. Tu n'as accès à AUCUNE donnée de vente réelle : tes réponses sont des estimations "
              "qualitatives. Réponds uniquement en JSON : {\"demand\":\"low|medium|high\",\"competition\":\"low|medium|high\","
              "\"risk\":\"low|medium|high\",\"compliance\":\"ok|review|forbidden\",\"compliance_notes\":\"...\","
              "\"resale_estimate_eur\":number|null,\"reasoning\":\"2 phrases max\"}. "
              "compliance=forbidden pour contrefaçon probable, produits interdits sur Vinted ; review si marque de luxe ou doute.")
    prompt = json.dumps({"name": opp.name, "brand": opp.brand, "category": opp.category, "description": (opp.description or "")[:500],
                         "purchase_price_eur": str(opp.purchase_price)}, ensure_ascii=False)
    out = ai.complete(db, agent_key="market_analyst", purpose="enrich_opportunity", system=system, prompt=prompt, tier="reasoning", max_tokens=600)
    text = out["text"].strip().strip("`")
    if text.startswith("json"):
        text = text[4:]
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    filled = []
    for f in ("demand", "competition", "risk"):
        if getattr(opp, f) is None and data.get(f) in ("low", "medium", "high"):
            setattr(opp, f, data[f]); filled.append(f)
    if opp.compliance == "unknown" and data.get("compliance") in ("ok", "review", "forbidden"):
        opp.compliance = data["compliance"]; filled.append("compliance")
    opp.compliance_notes = data.get("compliance_notes") or opp.compliance_notes
    est = data.get("resale_estimate_eur")
    if est is not None:
        opp.ai_resale_estimate = q2(est)
    opp.score_detail = {**(opp.score_detail or {}), "ai": {"filled": filled, "reasoning": data.get("reasoning"), "estimate": est,
                                                           "warning": "Estimation IA non vérifiée — ne remplace pas des prix observés."}}
    analyze(db, opp)
    return {"filled": filled, "estimate": est, "cached": out["cached"]}


def prepare_baskets(db: Session, limit: int = 5, actor="purchase_manager") -> dict:
    """Prépare des commandes « en attente de validation ». Aucun paiement, aucune commande réelle."""
    cfg = S.get_all(db)
    busy = {r[0] for r in db.query(PurchaseLine.opportunity_id).join(PurchaseOrder).filter(
        PurchaseOrder.status.in_(OPEN_PO), PurchaseLine.opportunity_id.isnot(None)).all()}
    cands = (db.query(Opportunity).filter(Opportunity.status.in_(["recommended"]), Opportunity.score.isnot(None),
                                          Opportunity.availability != "out_of_stock", Opportunity.compliance != "forbidden")
             .order_by(Opportunity.score.desc()).limit(limit * 4).all())
    wanted = [str(c).strip().lower() for c in cfg.get("categories", []) if str(c).strip()]
    if wanted:  # « Catégories recherchées » : filtre les paniers automatiques
        cands = [c for c in cands if (c.category or "").strip().lower() in wanted]
    cands = [c for c in cands if c.id not in busy]
    cands = [c for c in cands if not c.supplier_id or (db.get(Supplier, c.supplier_id) and db.get(Supplier, c.supplier_id).allowed)][:limit]
    groups: dict = {}
    for c in cands:
        groups.setdefault(c.supplier_id, []).append(c)
    created, skipped = [], []
    qty = max(1, int(cfg["default_quantity"]))
    for sid, opps in groups.items():
        sup = db.get(Supplier, sid) if sid else None
        ship = D(sup.default_shipping) if sup and D(sup.default_shipping) > 0 else sum((D(o.shipping_cost) * qty for o in opps), Decimal("0"))
        lines = [{"name": o.name, "unit_price": o.purchase_price, "quantity": qty, "opportunity_id": o.id, "category": o.category,
                  "brand": o.brand, "image_url": o.image_url, "supplier_url": o.supplier_url, "planned_resale_price": o.resale_price} for o in opps]
        order = purchasing.create_order(db, supplier_id=sid, lines=lines, shipping_cost=ship, status="awaiting_validation",
                                        auto_prepared=True, notes="Préparée automatiquement — à valider.")
        problems = purchasing.check_budget(db, order)
        if problems:
            db.delete(order); db.flush()
            skipped.append({"supplier_id": sid, "reasons": problems})
            continue
        created.append(order.id)
        events.log(db, "basket_prepared", f"Panier #{order.id} préparé ({len(lines)} produit(s)) : en attente de validation", actor=actor,
                   entity="purchase_order", entity_id=order.id)
    if created:
        events.notify(db, "purchase_awaiting_validation", f"{len(created)} achat(s) attendent votre validation",
                      "Paniers préparés automatiquement dans le budget.", severity="info", link="/achats?status=awaiting_validation",
                      dedupe_key=f"baskets-{now():%Y%m%d%H}")
    return {"orders_created": created, "skipped": skipped}
