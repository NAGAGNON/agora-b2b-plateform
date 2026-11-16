"""Auth, paramètres, clés API, tableau de bord, notifications, journal, recherche globale."""
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import or_
from ..config import env
from ..db import DB
from ..models import (ActivityLog, InventoryItem, Notification, Opportunity, PurchaseOrder, Sale, Secret, now)
from ..security import COOKIE, check_password, encrypt, make_token, verify_token
from ..serialize import js, ser
from ..services import ai, alerts, events, finance, settings as S
from .. import models

public = APIRouter(prefix="/api/auth", tags=["auth"])
router = APIRouter(prefix="/api", tags=["core"])
SECRET_NAMES = {"anthropic_api_key": "Clé API Claude", "vinted_api_token": "Jeton API Vinted Pro Integrations",
                "supplier_api_key": "Clé API fournisseur (générique)"}


class Login(BaseModel):
    password: str


_attempts: dict[str, list[float]] = {}


@public.post("/login")
def login(body: Login, request: Request, response: Response):
    import time
    ip = request.client.host if request.client else "?"
    recent = [t for t in _attempts.get(ip, []) if t > time.time() - 600]
    if len(recent) >= 8:
        raise HTTPException(429, "Trop de tentatives : réessayez dans quelques minutes.")
    if not env().admin_password:
        raise HTTPException(503, "ADMIN_PASSWORD n'est pas configuré sur le serveur.")
    if not check_password(body.password):
        _attempts[ip] = recent + [time.time()]
        raise HTTPException(401, "Mot de passe incorrect.")
    response.set_cookie(COOKIE, make_token(), httponly=True, samesite="lax", secure=env().cookie_secure, max_age=env().session_hours * 3600, path="/")
    return {"ok": True}


@public.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@public.get("/me")
def me(request: Request):
    return {"authenticated": verify_token(request.cookies.get(COOKIE))}


# ---- Paramètres ------------------------------------------------------------------------------
@router.get("/settings")
def get_settings(db: DB):
    return S.get_all(db)


@router.put("/settings")
def put_settings(values: dict, db: DB):
    try:
        out = S.set_many(db, values)
    except ValueError as e:
        raise HTTPException(400, str(e))
    events.log(db, "settings_updated", f"Paramètres modifiés : {', '.join(values)}")
    return out


@router.get("/secrets")
def list_secrets(db: DB):
    have = {s.name: s for s in db.query(Secret).all()}
    return [{"name": n, "label": l, "configured": n in have or (n == "anthropic_api_key" and bool(env().anthropic_api_key)),
             "last4": have[n].last4 if n in have else (("…" + env().anthropic_api_key[-4:]) if n == "anthropic_api_key" and env().anthropic_api_key else ""),
             "source": "base (chiffrée)" if n in have else ("variable d'environnement" if n == "anthropic_api_key" and env().anthropic_api_key else None)}
            for n, l in SECRET_NAMES.items()] + [{"name": s.name, "label": s.name, "configured": True, "last4": s.last4, "source": "base (chiffrée)"}
                                                  for s in have.values() if s.name not in SECRET_NAMES]


class SecretIn(BaseModel):
    value: str


@router.put("/secrets/{name}")
def put_secret(name: str, body: SecretIn, db: DB):
    if not name.replace("_", "").isalnum() or len(name) > 60:
        raise HTTPException(400, "Nom de secret invalide.")
    v = body.value.strip()
    if len(v) < 8:
        raise HTTPException(400, "Valeur trop courte.")
    row = db.get(Secret, name)
    if row:
        row.ciphertext, row.last4 = encrypt(v), v[-4:]
    else:
        db.add(Secret(name=name, ciphertext=encrypt(v), last4=v[-4:]))
    events.log(db, "secret_set", f"Clé « {name} » enregistrée (chiffrée)")
    return {"ok": True}


@router.delete("/secrets/{name}")
def delete_secret(name: str, db: DB):
    row = db.get(Secret, name)
    if row:
        db.delete(row)
        events.log(db, "secret_deleted", f"Clé « {name} » supprimée")
    return {"ok": True}


@router.get("/ai/usage")
def ai_usage(db: DB):
    return js(ai.usage_summary(db))


# ---- Dashboard ---------------------------------------------------------------------------------
TIMELINE_LABELS = {
    "opportunity_new": "Nouveau produit détecté", "source_synced": "Catalogue synchronisé", "opportunity_validated": "Opportunité validée",
    "purchase_ordered": "Achat effectué", "purchase_received": "Produit réceptionné", "listing_prepared": "Annonce préparée",
    "listing_published": "Annonce publiée", "sale_detected": "Produit vendu", "sale_status": "Statut de vente", "payout_received": "Paiement reçu",
}


@router.get("/dashboard")
def dashboard(db: DB):
    data = finance.dashboard(db)
    series = finance.series(db, 12)
    timeline = db.query(ActivityLog).filter(ActivityLog.action != "agent_message").order_by(ActivityLog.id.desc()).limit(25).all()
    return js({"kpis": data, "series": series, "by_category": finance.sales_by_category(db),
               "alerts": alerts.compute(db),
               "timeline": [ser(t, label=TIMELINE_LABELS.get(t.action)) for t in timeline],
               "has_data": db.query(Sale).count() + db.query(models.Expense).count() + db.query(Opportunity).count() > 0})


# ---- Notifications --------------------------------------------------------------------------------
@router.get("/notifications")
def list_notifications(db: DB, unread: bool = False, limit: int = 100):
    q = db.query(Notification)
    if unread:
        q = q.filter(Notification.read_at.is_(None))
    return {"unread": db.query(Notification).filter(Notification.read_at.is_(None)).count(),
            "items": [ser(n) for n in q.order_by(Notification.id.desc()).limit(min(limit, 300)).all()]}


@router.post("/notifications/{nid}/read")
def read_notification(nid: int, db: DB):
    n = db.get(Notification, nid)
    if not n:
        raise HTTPException(404, "Notification introuvable")
    n.read_at = n.read_at or now()
    return {"ok": True}


@router.post("/notifications/read-all")
def read_all(db: DB):
    db.query(Notification).filter(Notification.read_at.is_(None)).update({"read_at": now()})
    return {"ok": True}


@router.get("/activity")
def activity(db: DB, limit: int = 100, actor: str | None = None, entity: str | None = None):
    q = db.query(ActivityLog)
    if actor:
        q = q.filter(ActivityLog.actor == actor)
    if entity:
        q = q.filter(ActivityLog.entity == entity)
    return [ser(a) for a in q.order_by(ActivityLog.id.desc()).limit(min(limit, 500)).all()]


@router.get("/search")
def search(q: str, db: DB):
    q = q.strip()
    if len(q) < 2:
        return []
    like = f"%{q}%"
    out = []
    for o in db.query(Opportunity).filter(or_(Opportunity.name.ilike(like), Opportunity.brand.ilike(like))).limit(6):
        out.append({"type": "Opportunité", "title": o.name, "sub": f"score {o.score}" if o.score is not None else "non notée", "href": f"/opportunites?id={o.id}"})
    for i in db.query(InventoryItem).filter(or_(InventoryItem.name.ilike(like), InventoryItem.sku.ilike(like))).limit(6):
        out.append({"type": "Stock", "title": i.name, "sub": i.sku, "href": f"/stock/{i.id}"})
    for s in db.query(Sale).join(InventoryItem).filter(or_(InventoryItem.name.ilike(like), Sale.order_ref.ilike(like))).limit(5):
        out.append({"type": "Vente", "title": s.item.name, "sub": f"{s.sale_price} €", "href": f"/ventes/{s.id}"})
    for p in db.query(PurchaseOrder).filter(or_(PurchaseOrder.reference.ilike(like), PurchaseOrder.tracking_number.ilike(like))).limit(4):
        out.append({"type": "Achat", "title": f"Commande #{p.id}", "sub": p.reference or "", "href": f"/achats/{p.id}"})
    return out
