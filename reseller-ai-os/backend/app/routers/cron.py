"""Appel périodique pour l'hébergement serverless (Vercel Cron). Protégé par CRON_SECRET, pas par le cookie."""
import hmac
from fastapi import APIRouter, HTTPException, Request
from ..config import env
from ..db import SessionLocal
from ..services import agents, automation

router = APIRouter(prefix="/api/cron", tags=["cron"])


def ensure_seeded():
    db = SessionLocal()
    try:
        agents.seed(db)
        automation.seed(db)
        db.commit()
    except Exception:  # démarrages concurrents : l'autre instance a déjà inséré
        db.rollback()
    finally:
        db.close()


@router.get("/tick")
def tick(request: Request):
    secret = env().cron_secret
    if not secret:
        raise HTTPException(503, "CRON_SECRET n'est pas configuré.")
    sent = request.headers.get("authorization", "")
    if not hmac.compare_digest(sent, f"Bearer {secret}"):
        raise HTTPException(401, "Non autorisé")
    ensure_seeded()
    return automation.run_due()
