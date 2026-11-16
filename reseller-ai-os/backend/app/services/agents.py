"""Système multi-agents : registre, tâches, historique, bus de messages avec dédoublonnage,
et Operations Manager (détection d'erreurs, relances)."""
import traceback
from sqlalchemy.orm import Session
from ..models import Agent, AgentMessage, AgentTask, now
from . import events

AGENTS = [
    ("operations_manager", "AI Operations Manager", "Coordonner les agents, détecter les erreurs et signaler les blocages.",
     ["Aucune tâche en erreur non traitée", "Aucun message inter-agents en attente > 1 h"], True),
    ("opportunity_hunter", "Opportunity Hunter", "Synchroniser les sources de catalogues autorisées et détecter de nouveaux produits.",
     ["Catalogues à jour", "Nouveaux produits dédoublonnés"], False),
    ("market_analyst", "Market Analyst", "Évaluer prix de revente, marge, demande, concurrence, risque et confiance ; noter /100.",
     ["Toutes les opportunités notées", "Aucune donnée inventée"], True),
    ("profit_manager", "Profit Manager", "Moteur de rentabilité (code classique) : coûts, marges, budgets, seuils.",
     ["Respect des marges minimales", "Budgets surveillés"], False),
    ("supplier_manager", "Supplier Manager", "Suivre les fournisseurs, leurs sources et la disponibilité.",
     ["Sources en bon état", "Ruptures signalées"], False),
    ("purchase_manager", "Purchase Manager", "Préparer les commandes (jamais de paiement sans validation) et suivre leur statut.",
     ["Commandes préparées dans le budget", "Dépenses comptabilisées"], False),
    ("inventory_manager", "Inventory Manager", "Tenir le stock, réceptionner, détecter les articles non publiés.",
     ["Stock fidèle à la réalité", "Aucun article reçu oublié"], False),
    ("listing_creator", "Listing Creator", "Préparer titres, descriptions, prix et photos des annonces.",
     ["Annonces prêtes dès réception", "Conformité Vinted vérifiée"], True),
    ("vinted_manager", "Vinted Manager", "Suivre annonces, publications, incidents ; mode assisté ou API officielle si accordée.",
     ["Liens d'annonces enregistrés", "Incidents traités"], False),
    ("sales_manager", "Sales Manager", "Enregistrer les ventes et orchestrer la suite (stock, finance, expédition).",
     ["Chaque vente propagée aux bons agents"], False),
    ("shipping_manager", "Shipping Manager", "Suivre les expéditions et les dates limites.",
     ["Zéro retard d'expédition"], False),
    ("financial_analyst", "Financial Analyst", "Suivre trésorerie, marges et bilans mensuels.",
     ["Bilan mensuel à jour", "Budgets respectés"], False),
]
KEYS = [a[0] for a in AGENTS]


def seed(db: Session):
    for key, name, mission, objectives, ai in AGENTS:
        if not db.get(Agent, key):
            db.add(Agent(key=key, name=name, mission=mission, objectives=objectives, uses_ai=ai,
                         ai_budget_daily=0.5 if ai else 0, ai_budget_monthly=7 if ai else 0))
    db.flush()


# ---- Tâches --------------------------------------------------------------------------------
def run_task(db: Session, agent_key: str, title: str, fn, *, trigger="manual"):
    """Exécute fn(db) sous le suivi d'un agent. Les erreurs sont capturées, journalisées et signalées."""
    agent = db.get(Agent, agent_key)
    if agent is None:
        raise KeyError(agent_key)
    task = AgentTask(agent_key=agent_key, title=title, status="running", trigger=trigger, started_at=now())
    db.add(task)
    if not agent.enabled:
        task.status, task.error, task.finished_at = "error", "Agent désactivé", now()
        db.flush()
        return task
    agent.status = "running"
    db.flush()
    try:
        with db.begin_nested():
            result = fn(db)
        task.status, task.result = "done", result if isinstance(result, dict) else {"result": result}
        agent.status, agent.last_error = "idle", None
    except Exception as exc:  # noqa: BLE001 — l'erreur est remontée à l'utilisateur, jamais avalée
        task.status, task.error = "error", f"{type(exc).__name__}: {exc}"
        agent.status, agent.last_error = "error", task.error
        events.log(db, "agent_error", f"{agent.name} : {task.error}", actor=agent_key, payload={"trace": traceback.format_exc()[-1500:]})
        events.notify(db, "agent_error", f"Erreur de l'agent {agent.name}", task.error, severity="danger", link="/agents",
                      dedupe_key=f"agent-error-{agent_key}-{task.id or now().isoformat()}")
    task.finished_at = agent.last_run_at = now()
    db.flush()
    return task


# ---- Bus de messages -----------------------------------------------------------------------
HANDLERS: dict[tuple[str, str], callable] = {}


def handler(to_agent: str, subject: str):
    def deco(fn):
        HANDLERS[(to_agent, subject)] = fn
        return fn
    return deco


def publish(db: Session, from_agent: str, to_agent: str, subject: str, payload: dict, *, dedupe_key: str | None = None):
    """Publie et traite immédiatement. dedupe_key évite qu'un même fait soit traité deux fois."""
    if dedupe_key and db.query(AgentMessage).filter_by(dedupe_key=dedupe_key).first():
        return None
    msg = AgentMessage(from_agent=from_agent, to_agent=to_agent, subject=subject, payload=payload, dedupe_key=dedupe_key)
    db.add(msg)
    db.flush()
    process(db, msg)
    return msg


def process(db: Session, msg: AgentMessage):
    fn = HANDLERS.get((msg.to_agent, msg.subject))
    try:
        with db.begin_nested():
            if fn:
                fn(db, msg.payload)
        msg.status, msg.handled_at = "handled", now()
        events.log(db, "agent_message", f"{msg.from_agent} → {msg.to_agent} : {msg.subject}", actor=msg.from_agent, payload=msg.payload)
    except Exception as exc:  # noqa: BLE001
        msg.status, msg.error = "error", f"{type(exc).__name__}: {exc}"
    db.flush()


def retry_failed(db: Session) -> int:
    n = 0
    for msg in db.query(AgentMessage).filter(AgentMessage.status.in_(["error", "pending"])).all():
        process(db, msg)
        n += msg.status == "handled"
    return n


# ---- Gestionnaires de passation --------------------------------------------------------------
@handler("profit_manager", "unprofitable_opportunity")
def _h_unprofitable(db, p):
    from ..models import Opportunity
    opp = db.get(Opportunity, p["opportunity_id"])
    if opp and opp.status in ("new", "to_study", "recommended"):
        opp.status = "rejected"
        events.log(db, "opportunity_rejected", f"« {opp.name} » écartée : non rentable ({p.get('reason', '')})", actor="profit_manager",
                   entity="opportunity", entity_id=opp.id)


@handler("inventory_manager", "order_received")
def _h_order_received(db, p):
    events.log(db, "stock_updated", f"Stock mis à jour : {p['items']} article(s) reçus (commande #{p['order_id']})", actor="inventory_manager",
               entity="purchase_order", entity_id=p["order_id"])


@handler("financial_analyst", "sale_recorded")
def _h_sale_fin(db, p):
    from ..models import Sale
    from . import sales
    s = db.get(Sale, p["sale_id"])
    if s:
        events.log(db, "revenue_recorded", f"CA enregistré : {s.sale_price} € (bénéfice prévisionnel {sales.figures(s)['profit']} €)",
                   actor="financial_analyst", entity="sale", entity_id=s.id)


@handler("shipping_manager", "sale_to_ship")
def _h_sale_ship(db, p):
    from ..models import Sale
    s = db.get(Sale, p["sale_id"])
    if s and s.shipment:
        events.log(db, "shipping_task", f"Expédition à préparer avant le {s.shipment.deadline:%d/%m/%Y}", actor="shipping_manager",
                   entity="sale", entity_id=s.id)


# ---- Operations Manager ---------------------------------------------------------------------
def operations_check(db: Session) -> dict:
    from datetime import timedelta
    problems = []
    for a in db.query(Agent).filter(Agent.status == "error").all():
        problems.append(f"Agent {a.name} en erreur : {a.last_error}")
    stuck = db.query(AgentMessage).filter(AgentMessage.status.in_(["error", "pending"]), AgentMessage.created_at < now() - timedelta(hours=1)).all()
    retried = retry_failed(db) if stuck else 0
    still = [m for m in stuck if m.status != "handled"]
    for m in still:
        problems.append(f"Message {m.from_agent}→{m.to_agent} ({m.subject}) non traité : {m.error}")
    for a in db.query(Agent).filter(Agent.status == "running", Agent.last_run_at < now() - timedelta(hours=2)).all():
        a.status = "error"; a.last_error = "Tâche bloquée en cours depuis plus de 2 h"
        problems.append(f"Agent {a.name} bloqué")
    if problems:
        events.notify(db, "ops_problem", f"{len(problems)} problème(s) détecté(s) par l'Operations Manager", "\n".join(problems[:6]),
                      severity="danger", link="/agents", dedupe_key=f"ops-{now():%Y%m%d%H}")
    return {"problems": problems, "retried": retried}
