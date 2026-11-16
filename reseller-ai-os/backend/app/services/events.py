"""Journal d'activité, notifications (in-app + e-mail optionnel)."""
import smtplib
from email.message import EmailMessage
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..config import env
from ..models import ActivityLog, Notification, now
from . import settings as S


def log(db: Session, action: str, summary: str, *, actor="user", entity=None, entity_id=None, payload=None):
    row = ActivityLog(actor=actor, action=action, entity=entity, entity_id=entity_id, summary=summary[:400], payload=payload)
    db.add(row)
    db.flush()
    return row


def notify(db: Session, kind: str, title: str, body: str | None = None, *, severity="info", link=None, dedupe_key=None):
    cfg = S.get_all(db)
    if kind in cfg.get("notify_kinds_disabled", []):
        return None
    if dedupe_key and db.query(Notification).filter_by(dedupe_key=dedupe_key).first():
        return None
    n = Notification(kind=kind, title=title[:200], body=body, severity=severity, link=link, dedupe_key=dedupe_key)
    db.add(n)
    db.flush()
    _maybe_email(db, n, cfg)
    return n


def _maybe_email(db: Session, n: Notification, cfg: dict):
    e = env()
    if not (cfg.get("notify_email_enabled") and cfg.get("notify_email_to") and e.smtp_host and e.smtp_from):
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = f"[Reseller AI OS] {n.title}"
        msg["From"] = e.smtp_from
        msg["To"] = cfg["notify_email_to"]
        msg.set_content((n.body or n.title))
        with smtplib.SMTP(e.smtp_host, e.smtp_port, timeout=10) as s:
            s.starttls()
            if e.smtp_user:
                s.login(e.smtp_user, e.smtp_password)
            s.send_message(msg)
        n.emailed_at = now()
    except Exception as exc:  # l'échec d'e-mail ne doit jamais bloquer le métier, mais il est tracé
        log(db, "email_failed", f"Envoi e-mail impossible : {exc}", actor="system")
