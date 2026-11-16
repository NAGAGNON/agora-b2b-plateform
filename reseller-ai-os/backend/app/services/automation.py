"""Moteur d'automatisation : tâches planifiées (APScheduler dans le processus API — pas de Redis/Celery à opérer
pour un usage mono-utilisateur), fréquence configurable par tâche, calendrier des exécutions."""
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from ..config import env
from ..core import timez
from ..db import SessionLocal
from ..models import AutomationJob, AgentTask, InventoryItem, Listing, Sale, Source, now
from . import agents, analysis, events, importer, inventory as inv, listing as listing_svc, purchasing, settings as S

log = logging.getLogger("automation")


# ---- Implémentations des tâches --------------------------------------------------------------
def job_hunter_sync(db: Session) -> dict:
    total = {"created": 0, "updated": 0, "sources": 0, "errors": []}
    for src in db.query(Source).filter(Source.enabled.is_(True), Source.kind.in_(["csv_url", "json_url"])).all():
        try:
            r = importer.sync_source(db, src)
            total["created"] += r["created"]; total["updated"] += r["updated"]; total["sources"] += 1
        except Exception as e:  # noqa: BLE001
            src.last_status = f"Échec : {e}"[:300]
            total["errors"].append(f"{src.name}: {e}")
    if total["created"]:
        events.notify(db, "new_products", f"{total['created']} nouveau(x) produit(s) détecté(s)", severity="info", link="/opportunites",
                      dedupe_key=f"new-products-{now():%Y%m%d%H}")
    if total["errors"] and total["sources"] == 0:
        raise RuntimeError("; ".join(total["errors"]))
    if total["sources"] == 0 and not total["errors"]:
        total["note"] = "Aucune source distante activée."
    return total


def job_analyze(db: Session) -> dict:
    return analysis.analyze_all(db, only_unanalyzed=True)


def job_rank(db: Session) -> dict:
    return analysis.analyze_all(db)


def job_recommend(db: Session) -> dict:
    return analysis.prepare_baskets(db, limit=5)


def job_inventory_check(db: Session) -> dict:
    days = int(S.get(db, "unpublished_alert_days"))
    items = inv.unpublished_after_reception(db, days)
    for it in items:
        events.notify(db, "unpublished", f"Non publié : {it.name}", f"Reçu depuis plus de {days} jours", severity="warning", link=f"/stock/{it.id}",
                      dedupe_key=f"unpub-{it.id}")
    return {"unpublished": len(items)}


def job_shipping_check(db: Session) -> dict:
    late = 0
    for s in db.query(Sale).filter(Sale.status.in_(["detected", "payment_pending", "payment_confirmed", "to_ship"])).all():
        if s.shipment and s.shipment.deadline and s.shipment.deadline < now():
            late += 1
            events.notify(db, "ship_late", f"Retard d'expédition : {s.item.name}", f"Date limite dépassée ({s.shipment.deadline:%d/%m})",
                          severity="danger", link="/expeditions", dedupe_key=f"late-{s.id}")
    return {"late": late}


def job_listing_prepare(db: Session) -> dict:
    n = 0
    for it in db.query(InventoryItem).filter(InventoryItem.status.in_(["received", "to_photograph", "ready"])).all():
        if not db.query(Listing).filter(Listing.item_id == it.id, Listing.status.in_(["draft", "ready", "published"])).first():
            listing_svc.upsert_draft(db, it)
            n += 1
    return {"drafts_created": n}


def job_finance_check(db: Session) -> dict:
    purchasing._budget_alert(db)
    return {"budget": {k: str(v) for k, v in purchasing.budget_status(db).items()}}


def job_ops_check(db: Session) -> dict:
    return agents.operations_check(db)


JOBS = {
    "hunter_sync": ("opportunity_hunter", "Détection de nouvelles opportunités", job_hunter_sync, dict(schedule_type="daily", hour=8, minute=0)),
    "market_analyze": ("market_analyst", "Analyse commerciale", job_analyze, dict(schedule_type="daily", hour=9, minute=0)),
    "market_rank": ("market_analyst", "Classement des opportunités", job_rank, dict(schedule_type="daily", hour=10, minute=0)),
    "purchase_recommend": ("purchase_manager", "Recommandations d'achat (paniers à valider)", job_recommend, dict(schedule_type="daily", hour=11, minute=0)),
    "listing_prepare": ("listing_creator", "Préparation des annonces des articles reçus", job_listing_prepare, dict(schedule_type="daily", hour=12, minute=0)),
    "inventory_check": ("inventory_manager", "Contrôle des articles non publiés", job_inventory_check, dict(schedule_type="interval", interval_minutes=360)),
    "shipping_check": ("shipping_manager", "Contrôle des délais d'expédition", job_shipping_check, dict(schedule_type="interval", interval_minutes=120)),
    "finance_check": ("financial_analyst", "Contrôle des budgets", job_finance_check, dict(schedule_type="daily", hour=18, minute=0)),
    "ops_check": ("operations_manager", "Supervision des agents", job_ops_check, dict(schedule_type="interval", interval_minutes=30)),
}


def seed(db: Session):
    for key, (agent, label, _fn, sched) in JOBS.items():
        if not db.get(AutomationJob, key):
            db.add(AutomationJob(key=key, agent_key=agent, label=label, enabled=True, **sched))
    db.flush()


def run_job(key: str, trigger="schedule", session_factory=SessionLocal) -> dict:
    db = session_factory()
    try:
        job = db.get(AutomationJob, key)
        if not job or key not in JOBS:
            return {"error": "Tâche inconnue"}
        _agent, label, fn, _ = JOBS[key]
        task = agents.run_task(db, job.agent_key, label, fn, trigger=trigger)
        job.last_run_at = now()
        job.last_status = "OK" if task.status == "done" else f"Erreur : {task.error}"[:300]
        db.commit()
        return {"status": task.status, "result": task.result, "error": task.error}
    except Exception:
        db.rollback()
        log.exception("job %s", key)
        raise
    finally:
        db.close()


# ---- Planification ---------------------------------------------------------------------------
_scheduler: BackgroundScheduler | None = None


def _trigger(job: AutomationJob):
    if job.schedule_type == "interval":
        return IntervalTrigger(minutes=max(5, int(job.interval_minutes or 60)), timezone=env().timezone)
    return CronTrigger(hour=job.hour, minute=job.minute, day_of_week=job.days or "mon-sun", timezone=env().timezone)


def reschedule(db: Session):
    if _scheduler is None:
        return
    for j in _scheduler.get_jobs():
        j.remove()
    for job in db.query(AutomationJob).filter(AutomationJob.enabled.is_(True)).all():
        _scheduler.add_job(run_job, _trigger(job), args=[job.key], id=job.key, replace_existing=True, coalesce=True, max_instances=1,
                           misfire_grace_time=3600)


def start():
    global _scheduler
    if not env().scheduler_enabled or _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone=env().timezone)
    _scheduler.start()
    db = SessionLocal()
    try:
        reschedule(db)
    finally:
        db.close()


def stop():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def due_jobs(db: Session, at=None) -> list[str]:
    """Tâches actives dont une échéance est passée depuis leur dernière exécution (mode serverless : un appel
    périodique « tick » remplace le planificateur en mémoire). Une tâche jamais exécutée est due dès qu'une échéance
    est tombée dans les dernières 24 h."""
    at = at or now()
    out = []
    for job in db.query(AutomationJob).filter(AutomationJob.enabled.is_(True)).all():
        baseline = job.last_run_at or (at - timedelta(days=1))
        nxt = _trigger(job).get_next_fire_time(None, baseline)
        if nxt is not None and nxt <= at and job.key in JOBS:
            out.append(job.key)
    return out


def run_due(session_factory=SessionLocal) -> dict:
    db = session_factory()
    try:
        keys = due_jobs(db)
    finally:
        db.close()
    results = {k: run_job(k, trigger="schedule", session_factory=session_factory) for k in keys}
    return {"ran": keys, "results": {k: v.get("status") for k, v in results.items()}}


def calendar(db: Session, days: int = 14) -> dict:
    start_t, end_t = now(), now() + timedelta(days=days)
    upcoming = []
    for job in db.query(AutomationJob).filter(AutomationJob.enabled.is_(True)).all():
        trig = _trigger(job)
        prev, t = None, start_t
        for _ in range(500):
            nxt = trig.get_next_fire_time(prev, t)
            if nxt is None or nxt > end_t:
                break
            upcoming.append({"job": job.key, "label": job.label, "agent": job.agent_key, "at": nxt.astimezone(timez.tz()).isoformat()})
            prev, t = nxt, nxt + timedelta(seconds=1)
    upcoming.sort(key=lambda x: x["at"])
    past = (db.query(AgentTask).filter(AgentTask.created_at >= start_t - timedelta(days=days)).order_by(AgentTask.created_at.desc()).limit(200).all())
    return {"upcoming": upcoming, "past": [{"id": t.id, "agent": t.agent_key, "title": t.title, "status": t.status, "at": t.created_at, "trigger": t.trigger,
                                           "error": t.error} for t in past]}
