"""Finance, agents, automatisation, centre de contrôle IA."""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from ..core import timez
from ..core.money import q2
from ..db import DB
from ..models import (Agent, AgentMessage, AgentTask, ActivityLog, AutomationJob, Conversation, Expense, Sale, now)
from ..serialize import js, ser
from ..services import agents as agents_svc, ai, automation, chat, events, finance, purchasing

router = APIRouter(prefix="/api", tags=["finance-ai"])


def nf(obj, what):
    if obj is None:
        raise HTTPException(404, f"{what} introuvable")
    return obj


# ---- Finance -----------------------------------------------------------------------------------
@router.get("/finance/overview")
def overview(db: DB):
    n = timez.local(now())
    yr_start = timez.month_start(n.year, 1)
    m0, m1 = timez.month_range(n.year, n.month)
    from datetime import timedelta
    end = now() + timedelta(days=1)
    return js({
        "cash": finance.cash(db), "budget": purchasing.budget_status(db),
        "pnl": {"day": finance.pnl(db, timez.start_of_day(now()), end), "week": finance.pnl(db, timez.start_of_week(now()), end),
                "month": finance.pnl(db, m0, m1), "year": finance.pnl(db, yr_start, end)},
        "expenses_month": finance.expenses_breakdown(db, m0, m1), "expenses_year": finance.expenses_breakdown(db, yr_start, end),
        "series": finance.series(db, 12), "by_product": finance.profit_by_product(db, 30),
        "categories": [{"key": k, "label": v} for k, v in finance.CATEGORIES.items()],
    })


@router.get("/finance/month/{year}/{month}")
def month_report(year: int, month: int, db: DB):
    if not (1 <= month <= 12 and 2000 <= year <= 2100):
        raise HTTPException(400, "Mois invalide.")
    return js(finance.month_report(db, year, month))


@router.get("/finance/months")
def months(db: DB, count: int = 12):
    n = timez.local(now())
    return js([finance.month_report(db, *timez.add_months(n.year, n.month, -i)) for i in range(min(count, 36))])


class ExpenseIn(BaseModel):
    date: datetime | None = None
    category: str
    amount: float = Field(gt=0)
    description: str | None = None
    vendor: str | None = None


@router.get("/expenses")
def list_expenses(db: DB, category: str | None = None, include_voided: bool = False, limit: int = 300):
    q = db.query(Expense)
    if category:
        q = q.filter(Expense.category == category)
    if not include_voided:
        q = q.filter(Expense.voided_at.is_(None))
    return js([ser(e) for e in q.order_by(Expense.date.desc()).limit(min(limit, 1000)).all()])


@router.post("/expenses")
def create_expense(b: ExpenseIn, db: DB):
    if b.category not in finance.CATEGORIES or b.category == "achats_fournisseurs":
        raise HTTPException(400, "Catégorie invalide (les achats de stock passent par une commande fournisseur).")
    e = Expense(date=b.date or now(), category=b.category, amount=q2(b.amount), description=b.description, vendor=b.vendor)
    db.add(e); db.flush()
    events.log(db, "expense_created", f"Dépense : {e.amount} € ({finance.CATEGORIES[e.category]})", entity="expense", entity_id=e.id)
    return js(ser(e))


@router.post("/expenses/{eid}/void")
def void_expense(eid: int, db: DB):
    e = nf(db.get(Expense, eid), "Dépense")
    if e.auto:
        raise HTTPException(409, "Écriture automatique : annulez la commande ou la vente concernée.")
    e.voided_at = now()
    events.log(db, "expense_voided", f"Dépense annulée : {e.amount} €", entity="expense", entity_id=e.id)
    return js(ser(e))


# ---- Agents ------------------------------------------------------------------------------------
@router.get("/agents")
def list_agents(db: DB):
    out = []
    n = now()
    m0 = timez.start_of_month(n)
    for a in db.query(Agent).order_by(Agent.key).all():
        tasks = db.query(AgentTask).filter_by(agent_key=a.key).order_by(AgentTask.id.desc()).limit(8).all()
        st = ai.budget_state(db, a.key) if a.uses_ai else None
        out.append(ser(a, tasks=[ser(t) for t in tasks], ai_spent_month=ai.spent(db, m0, a.key) if a.uses_ai else 0,
                       ai_spent_today=ai.spent(db, timez.start_of_day(n), a.key) if a.uses_ai else 0,
                       tasks_done=db.query(AgentTask).filter_by(agent_key=a.key, status="done").count(),
                       tasks_error=db.query(AgentTask).filter_by(agent_key=a.key, status="error").count(),
                       jobs=[ser(j) for j in db.query(AutomationJob).filter_by(agent_key=a.key).all()]))
    msgs = db.query(AgentMessage).order_by(AgentMessage.id.desc()).limit(40).all()
    return js({"agents": out, "messages": [ser(m) for m in msgs], "ai": ai.usage_summary(db)})


class AgentIn(BaseModel):
    enabled: bool | None = None
    ai_budget_daily: float | None = Field(None, ge=0)
    ai_budget_monthly: float | None = Field(None, ge=0)
    mission: str | None = None
    objectives: list[str] | None = None


@router.put("/agents/{key}")
def update_agent(key: str, b: AgentIn, db: DB):
    a = nf(db.get(Agent, key), "Agent")
    for k, v in b.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    a.status = "idle" if a.enabled and a.status == "disabled" else ("disabled" if not a.enabled else a.status)
    events.log(db, "agent_updated", f"Agent {a.name} mis à jour", entity="agent")
    return js(ser(a))


@router.post("/agents/{key}/reset")
def reset_agent(key: str, db: DB):
    a = nf(db.get(Agent, key), "Agent")
    a.status, a.last_error = ("idle" if a.enabled else "disabled"), None
    return js(ser(a))


# ---- Automatisation ------------------------------------------------------------------------------
@router.get("/automation/jobs")
def jobs(db: DB):
    return js([ser(j) for j in db.query(AutomationJob).order_by(AutomationJob.hour, AutomationJob.key).all()])


class JobIn(BaseModel):
    enabled: bool | None = None
    schedule_type: str | None = Field(None, pattern="^(daily|interval)$")
    hour: int | None = Field(None, ge=0, le=23)
    minute: int | None = Field(None, ge=0, le=59)
    days: str | None = None
    interval_minutes: int | None = Field(None, ge=5, le=10080)


@router.put("/automation/jobs/{key}")
def update_job(key: str, b: JobIn, db: DB):
    j = nf(db.get(AutomationJob, key), "Tâche")
    data = b.model_dump(exclude_none=True)
    if "days" in data:
        valid = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
        if not data["days"] or not set(data["days"].split(",")) <= valid:
            raise HTTPException(400, "Jours invalides (mon,tue,…).")
    for k, v in data.items():
        setattr(j, k, v)
    db.flush()
    automation.reschedule(db)
    events.log(db, "job_updated", f"Fréquence de « {j.label} » modifiée", entity="job")
    return js(ser(j))


@router.post("/automation/jobs/{key}/run")
def run_job_now(key: str, db: DB):
    if key not in automation.JOBS:
        raise HTTPException(404, "Tâche inconnue")
    _agent, label, fn, _ = automation.JOBS[key]
    j = nf(db.get(AutomationJob, key), "Tâche")
    task = agents_svc.run_task(db, j.agent_key, label, fn, trigger="manual")
    j.last_run_at, j.last_status = now(), "OK" if task.status == "done" else f"Erreur : {task.error}"[:300]
    return js(ser(task))


@router.get("/automation/calendar")
def cal(db: DB, days: int = 14):
    return js(automation.calendar(db, min(max(days, 1), 60)))


# ---- Centre de contrôle IA -------------------------------------------------------------------------
@router.get("/chat/conversations")
def convs(db: DB):
    return [{"id": c.id, "title": c.title, "created_at": c.created_at} for c in db.query(Conversation).order_by(Conversation.id.desc()).limit(50).all()]


@router.get("/chat/conversations/{cid}")
def conv(cid: int, db: DB):
    c = nf(db.get(Conversation, cid), "Conversation")
    msgs = []
    for m in c.messages:
        if m.role == "user" and all(b.get("type") == "tool_result" for b in m.content):
            continue
        text = "".join(b.get("text", "") for b in m.content if b.get("type") == "text")
        tools = [{"tool": b["name"], "args": b["input"], "is_action": b["name"] in chat.ACTIONS} for b in m.content if b.get("type") == "tool_use"]
        if text or tools:
            msgs.append({"id": m.id, "role": m.role, "text": text, "tools": tools, "at": m.created_at})
    return {"id": c.id, "title": c.title, "messages": msgs}


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None


@router.post("/chat")
def send(b: ChatIn, db: DB):
    c = db.get(Conversation, b.conversation_id) if b.conversation_id else None
    if b.conversation_id and not c:
        raise HTTPException(404, "Conversation introuvable")
    if not c:
        c = Conversation()
        db.add(c); db.flush()
    try:
        r = chat.send(db, c, b.message)
    except ai.AiUnavailable as e:
        raise HTTPException(503, str(e))
    except ai.AiBudgetExceeded as e:
        raise HTTPException(429, str(e))
    except Exception as e:  # erreurs d'API (réseau, 4xx/5xx) : visibles et compréhensibles
        import anthropic
        if isinstance(e, anthropic.APIStatusError):
            raise HTTPException(502, f"Erreur de l'API Claude ({e.status_code}) : {getattr(e, 'message', e)}")
        if isinstance(e, anthropic.APIConnectionError):
            raise HTTPException(502, "Impossible de joindre l'API Claude (réseau).")
        raise
    return {"conversation_id": c.id, **r}
