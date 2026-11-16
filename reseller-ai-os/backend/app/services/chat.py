"""AI Control Center : Claude pilote l'application en langage naturel via une liste BLANCHE d'outils.
Il lit les données réelles et peut lancer des actions réversibles ; il ne peut ni valider un achat, ni payer,
ni supprimer, ni modifier des paramètres. Chaque appel d'outil est journalisé (actor = « ai »)."""
import json
from datetime import timedelta
from sqlalchemy.orm import Session
from ..core import timez
from ..core.money import D, q2
from ..models import (Conversation, ConversationMessage, Expense, InventoryItem, Opportunity, PurchaseOrder, Sale, Source, now)
from . import ai, analysis, events, finance, importer, inventory as inv, listing as listing_svc, purchasing, sales as sales_svc, settings as S

MAX_STEPS = 8
SYSTEM = """Tu es l'assistant de pilotage de « Reseller AI OS », outil de gestion d'une activité de revente sur Vinted.
Règles :
- Réponds en français, de façon concise et chiffrée. Les montants sont en euros.
- N'affirme que ce que renvoient les outils : ne jamais inventer de prix de vente, de volumes ou de chiffres. Si une donnée manque, dis-le.
- Tu ne peux PAS valider ni payer un achat : tu peux seulement préparer des paniers « en attente de validation » que l'utilisateur valide lui-même.
- Distingue toujours chiffre d'affaires et bénéfice.
- Pour une demande d'action, appelle l'outil adapté puis résume le résultat réel (y compris les erreurs).
- Tu ne scrapes pas Vinted et ne contrôles pas Vinted : la publication reste manuelle (mode assisté) ou via API officielle si accordée."""


def _period(spec: str | None):
    n = now()
    spec = (spec or "month").lower()
    if spec == "today":
        return timez.start_of_day(n), n + timedelta(days=1), "aujourd'hui"
    if spec == "week":
        return timez.start_of_week(n), n + timedelta(days=1), "cette semaine"
    if spec == "year":
        l = timez.local(n)
        return timez.month_start(l.year, 1), n + timedelta(days=1), str(l.year)
    if len(spec) == 7 and spec[4] == "-":
        y, m = int(spec[:4]), int(spec[5:])
        a, b = timez.month_range(y, m)
        return a, b, spec
    a = timez.start_of_month(n)
    return a, n + timedelta(days=1), "ce mois-ci"


def _opp(o: Opportunity) -> dict:
    return {"id": o.id, "name": o.name, "supplier": o.supplier.name if o.supplier else None, "category": o.category,
            "purchase_price": str(o.purchase_price), "resale_price": str(o.resale_price) if o.resale_price else None,
            "resale_basis": o.resale_basis, "profit": str(o.est_profit) if o.est_profit is not None else None,
            "margin_pct": str(o.est_margin_pct) if o.est_margin_pct is not None else None, "score": o.score, "confidence": o.confidence,
            "status": o.status, "availability": o.availability, "missing": (o.score_detail or {}).get("missing")}


# ---- Outils ------------------------------------------------------------------------------------
def t_dashboard(db, a):
    return json.loads(json.dumps(finance.dashboard(db), default=str))


def t_finance(db, a):
    start, end, label = _period(a.get("period"))
    p = finance.pnl(db, start, end)
    p["expenses_by_category"] = finance.expenses_breakdown(db, start, end)
    return json.loads(json.dumps({"period": label, **p, "cash": finance.cash(db)}, default=str))


def t_search_opps(db, a):
    q = db.query(Opportunity).filter(Opportunity.score.isnot(None))
    if a.get("min_margin_pct") is not None:
        q = q.filter(Opportunity.est_margin_pct >= D(a["min_margin_pct"]))
    if a.get("min_profit") is not None:
        q = q.filter(Opportunity.est_profit >= D(a["min_profit"]))
    if a.get("min_score") is not None:
        q = q.filter(Opportunity.score >= int(a["min_score"]))
    if a.get("category"):
        q = q.filter(Opportunity.category.ilike(f"%{a['category']}%"))
    if not a.get("include_closed"):
        q = q.filter(Opportunity.status.in_(["new", "to_study", "recommended", "validated"]))
    rows = q.order_by(Opportunity.score.desc()).limit(min(int(a.get("limit", 10)), 30)).all()
    unscored = db.query(Opportunity).filter(Opportunity.score.is_(None)).count()
    return {"count": len(rows), "opportunities": [_opp(o) for o in rows], "unscored_opportunities_missing_resale_price": unscored}


def t_purchase_orders(db, a):
    q = db.query(PurchaseOrder)
    if a.get("status"):
        q = q.filter(PurchaseOrder.status == a["status"])
    else:
        q = q.filter(PurchaseOrder.status.in_(purchasing.OPEN))
    return [{"id": o.id, "status": purchasing.LABELS[o.status], "supplier": o.supplier.name if o.supplier else None, "total": str(purchasing.order_total(o)),
             "lines": [f"{l.quantity}× {l.name}" for l in o.lines]} for o in q.order_by(PurchaseOrder.id.desc()).limit(30).all()]


def t_sales(db, a):
    q = db.query(Sale)
    if a.get("status"):
        q = q.filter(Sale.status == a["status"])
    else:
        q = q.filter(Sale.status.in_(list(sales_svc.ACTIVE)))
    out = []
    for s in q.order_by(Sale.sold_at.desc()).limit(30).all():
        f = sales_svc.figures(s)
        out.append({"id": s.id, "item": s.item.name, "status": sales_svc.LABELS[s.status], "price": str(s.sale_price), "profit": str(f["profit"]),
                    "ship_before": s.shipment.deadline.isoformat() if s.shipment and s.shipment.deadline else None})
    return out


def t_inventory(db, a):
    q = db.query(InventoryItem)
    if a.get("status"):
        q = q.filter(InventoryItem.status == a["status"])
    else:
        q = q.filter(InventoryItem.status.in_(list(inv.IN_STOCK)))
    return [{"id": i.id, "sku": i.sku, "name": i.name, "status": inv.LABELS[i.status], "cost": str(q2(D(i.unit_cost) + D(i.extra_cost))),
             "received_at": i.received_at.isoformat() if i.received_at else None} for i in q.order_by(InventoryItem.id.desc()).limit(40).all()]


def t_sync_sources(db, a):
    from .automation import job_hunter_sync
    return job_hunter_sync(db)


def t_analyze(db, a):
    return analysis.analyze_all(db)


def t_prepare_baskets(db, a):
    return analysis.prepare_baskets(db, limit=min(int(a.get("count", 5)), 10), actor="ai")


def t_prepare_listings(db, a):
    n, names = 0, []
    today = timez.start_of_day(now())
    q = db.query(InventoryItem).filter(InventoryItem.status.in_(["received", "to_photograph", "ready"]))
    if a.get("received_today"):
        q = q.filter(InventoryItem.received_at >= today)
    for it in q.all():
        from ..models import Listing
        if not db.query(Listing).filter(Listing.item_id == it.id, Listing.status.in_(["draft", "ready", "published"])).first():
            listing_svc.upsert_draft(db, it)
            n += 1; names.append(it.name)
    return {"drafts_created": n, "items": names[:20]}


def t_promote(db, a):
    limit = now() - timedelta(days=int(a.get("min_days_online", 14)))
    rows = db.query(InventoryItem).filter(InventoryItem.status == "published", InventoryItem.published_at <= limit).order_by(InventoryItem.published_at).limit(15).all()
    return {"note": "Aucune donnée de vues/favoris Vinted n'est disponible : sélection basée uniquement sur l'ancienneté de publication.",
            "items": [{"id": i.id, "name": i.name, "price": str(i.listing_price), "days_online": (now() - i.published_at).days,
                       "break_even_margin": str(q2(D(i.listing_price or 0) - D(i.unit_cost) - D(i.extra_cost)))} for i in rows]}


TOOLS = [
    ("get_dashboard", "Indicateurs globaux : CA jour/semaine/mois, bénéfice, trésorerie, stock, ventes, commandes.", {}, t_dashboard),
    ("get_finance", "Finances d'une période (CA, coûts, bénéfice net, dépenses par catégorie, trésorerie).",
     {"period": {"type": "string", "description": "today | week | month | year | YYYY-MM"}}, t_finance),
    ("search_opportunities", "Recherche et classe les opportunités déjà analysées (score, marge, bénéfice).",
     {"min_margin_pct": {"type": "number"}, "min_profit": {"type": "number"}, "min_score": {"type": "integer"}, "category": {"type": "string"},
      "limit": {"type": "integer"}, "include_closed": {"type": "boolean"}}, t_search_opps),
    ("list_purchase_orders", "Commandes fournisseurs (par défaut celles en cours).", {"status": {"type": "string"}}, t_purchase_orders),
    ("list_sales", "Ventes (par défaut en cours) avec bénéfice et date limite d'expédition.", {"status": {"type": "string"}}, t_sales),
    ("list_inventory", "Articles du stock (par défaut ceux détenus).", {"status": {"type": "string"}}, t_inventory),
    ("sync_sources", "ACTION : synchronise les sources de catalogue distantes autorisées pour détecter de nouveaux produits.", {}, t_sync_sources),
    ("analyze_opportunities", "ACTION : recalcule score/marge de toutes les opportunités ouvertes (calcul local, sans IA).", {}, t_analyze),
    ("prepare_purchase_baskets", "ACTION : prépare des commandes « en attente de validation » pour les meilleures opportunités, dans le budget. Ne paie rien.",
     {"count": {"type": "integer"}}, t_prepare_baskets),
    ("prepare_listings", "ACTION : crée des brouillons d'annonces pour les articles reçus sans annonce.", {"received_today": {"type": "boolean"}}, t_prepare_listings),
    ("products_to_promote", "Articles publiés depuis longtemps à remettre en avant (ancienneté uniquement).", {"min_days_online": {"type": "integer"}}, t_promote),
]
TOOL_FN = {n: fn for n, _d, _s, fn in TOOLS}
ACTIONS = {"sync_sources", "analyze_opportunities", "prepare_purchase_baskets", "prepare_listings"}


def tool_defs() -> list[dict]:
    return [{"name": n, "description": d, "input_schema": {"type": "object", "properties": props, "additionalProperties": False}} for n, d, props, _ in TOOLS]


def run_tool(db: Session, name: str, args: dict) -> tuple[str, bool]:
    fn = TOOL_FN.get(name)
    if not fn:
        return f"Outil non autorisé : {name}", True
    try:
        with db.begin_nested():
            res = fn(db, args or {})
        events.log(db, "ai_tool", f"IA → {name}", actor="ai", payload={"args": args, "action": name in ACTIONS})
        return json.dumps(res, ensure_ascii=False, default=str)[:20000], False
    except Exception as e:  # noqa: BLE001
        events.log(db, "ai_tool_error", f"IA → {name} : {e}", actor="ai", payload={"args": args})
        return f"Erreur : {type(e).__name__}: {e}", True


def send(db: Session, conv: Conversation, user_text: str) -> dict:
    cfg = S.get_all(db)
    model = cfg["ai_model_reasoning"]
    ai.check_budget(db, "operations_manager")
    client = ai._client(db)
    db.add(ConversationMessage(conversation_id=conv.id, role="user", content=[{"type": "text", "text": user_text}]))
    db.flush()
    db.refresh(conv)
    if conv.title == "Nouvelle conversation":
        conv.title = user_text[:60]
    messages = [{"role": m.role, "content": m.content} for m in conv.messages]
    actions, final_text = [], ""
    for _ in range(MAX_STEPS):
        ai.check_budget(db, "operations_manager")
        resp = client.messages.create(model=model, max_tokens=4000, system=SYSTEM, tools=tool_defs(), messages=messages,
                                      output_config={"effort": "medium"})
        ai.record(db, "operations_manager", "control_center", model, resp.usage.input_tokens, resp.usage.output_tokens)
        blocks = [b.model_dump(exclude_none=True) for b in resp.content]
        db.add(ConversationMessage(conversation_id=conv.id, role="assistant", content=blocks))
        messages.append({"role": "assistant", "content": blocks})
        if resp.stop_reason == "refusal":
            final_text = "Le modèle a refusé cette demande."
            break
        if resp.stop_reason != "tool_use":
            final_text = "".join(b["text"] for b in blocks if b["type"] == "text")
            if resp.stop_reason == "max_tokens":
                final_text += "\n\n(Réponse tronquée : limite de longueur atteinte.)"
            break
        results = []
        for b in blocks:
            if b["type"] == "tool_use":
                out, err = run_tool(db, b["name"], b["input"])
                actions.append({"tool": b["name"], "args": b["input"], "error": err, "is_action": b["name"] in ACTIONS})
                results.append({"type": "tool_result", "tool_use_id": b["id"], "content": out, "is_error": err})
        db.add(ConversationMessage(conversation_id=conv.id, role="user", content=results))
        messages.append({"role": "user", "content": results})
    else:
        final_text = "Limite d'étapes atteinte avant la fin de la tâche."
    db.flush()
    return {"reply": final_text, "actions": actions}
