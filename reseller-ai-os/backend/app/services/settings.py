"""Paramètres applicatifs (clé/valeur JSON) avec valeurs par défaut."""
from sqlalchemy.orm import Session
from ..models import AppSetting

DEFAULTS: dict = {
    # Budgets et seuils (EUR)
    "initial_capital": 0,
    "budget_monthly": 0,        # 0 = illimité
    "budget_daily": 0,
    "budget_per_purchase": 0,
    "min_margin_pct": 20,
    "min_profit": 5,
    "excellent_score": 80,
    "default_quantity": 1,
    # Coûts par défaut du simulateur
    "default_packaging": 0.30,
    "default_operating": 0,
    "seller_fee_rate_pct": 0,   # Vinted : 0 % côté vendeur à la date de rédaction — à vérifier
    "seller_fee_fixed": 0,
    # Recherche
    "categories": [],
    # Délais
    "shipping_deadline_days": 5,
    "unpublished_alert_days": 3,
    "unusual_expense_factor": 3,
    # IA
    "ai_model_simple": "claude-haiku-5-5",
    "ai_model_reasoning": "claude-sonnet-5-5",
    "ai_budget_daily": 1.0,
    "ai_budget_monthly": 15.0,
    "ai_eur_per_usd": 0.92,
    "ai_price_per_mtok_usd": {
        "claude-haiku-5-5": [0.10, 0.50],
        "claude-sonnet-5-5": [2.00, 10.00],
        "claude-opus-5-5": [4.00, 20.00],
    },
    # Notifications
    "notify_email_to": "",
    "notify_email_enabled": False,
    "notify_kinds_disabled": [],
    # Vinted
    "vinted_title_max": 100,
    "vinted_description_max": 2000,
    "vinted_new_item_url": "https://www.vinted.fr/items/new",
}


def get_all(db: Session) -> dict:
    out = dict(DEFAULTS)
    for row in db.query(AppSetting).all():
        out[row.key] = row.value
    return out


def get(db: Session, key: str):
    row = db.get(AppSetting, key)
    return row.value if row else DEFAULTS.get(key)


def set_many(db: Session, values: dict) -> dict:
    unknown = [k for k in values if k not in DEFAULTS]
    if unknown:
        raise ValueError(f"Paramètre(s) inconnu(s) : {', '.join(unknown)}")
    for k, v in values.items():
        row = db.get(AppSetting, k)
        if row:
            row.value = v
        else:
            db.add(AppSetting(key=k, value=v))
    db.flush()
    return get_all(db)
