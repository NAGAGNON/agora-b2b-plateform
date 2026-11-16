"""Accès Claude avec garde-fous de coût : budgets global / par agent, cache, modèle économique par défaut.
Les calculs (marges, stock, stats) n'appellent JAMAIS ce module."""
import hashlib, json
from datetime import timedelta
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..config import env
from ..core import timez
from ..core.money import D
from ..models import Agent, AiCache, AiUsage, Secret, now
from ..security import decrypt
from . import settings as S


class AiUnavailable(RuntimeError):
    pass


class AiBudgetExceeded(RuntimeError):
    pass


def api_key(db: Session) -> str | None:
    row = db.get(Secret, "anthropic_api_key")
    if row:
        try:
            return decrypt(row.ciphertext)
        except Exception:
            return None
    return env().anthropic_api_key or None


def _client(db: Session):
    key = api_key(db)
    if not key:
        raise AiUnavailable("Clé API Claude non configurée (Paramètres → Clés API).")
    import anthropic
    return anthropic.Anthropic(api_key=key)


def cost_eur(cfg: dict, model: str, tin: int, tout: int) -> Decimal:
    price = cfg["ai_price_per_mtok_usd"].get(model)
    if not price:
        price = [4.0, 20.0]  # tarif prudent par défaut pour un modèle non listé
    usd = (D(tin) * D(price[0]) + D(tout) * D(price[1])) / Decimal(1_000_000)
    return (usd * D(cfg["ai_eur_per_usd"])).quantize(Decimal("0.00001"))


def spent(db: Session, since, agent_key: str | None = None) -> Decimal:
    q = db.query(func.coalesce(func.sum(AiUsage.cost_eur), 0)).filter(AiUsage.at >= since)
    if agent_key:
        q = q.filter(AiUsage.agent_key == agent_key)
    return D(q.scalar())


def budget_state(db: Session, agent_key: str | None = None) -> dict:
    cfg = S.get_all(db)
    n = now()
    d0, m0 = timez.start_of_day(n), timez.start_of_month(n)
    st = {"daily_limit": D(cfg["ai_budget_daily"]), "monthly_limit": D(cfg["ai_budget_monthly"]),
          "daily_spent": spent(db, d0), "monthly_spent": spent(db, m0)}
    if agent_key and (a := db.get(Agent, agent_key)):
        st.update({"agent_daily_limit": D(a.ai_budget_daily), "agent_monthly_limit": D(a.ai_budget_monthly),
                   "agent_daily_spent": spent(db, d0, agent_key), "agent_monthly_spent": spent(db, m0, agent_key)})
    return st


def check_budget(db: Session, agent_key: str):
    st = budget_state(db, agent_key)
    if st["daily_limit"] > 0 and st["daily_spent"] >= st["daily_limit"]:
        raise AiBudgetExceeded(f"Budget IA quotidien atteint ({st['daily_spent']:.2f} / {st['daily_limit']:.2f} €).")
    if st["monthly_limit"] > 0 and st["monthly_spent"] >= st["monthly_limit"]:
        raise AiBudgetExceeded(f"Budget IA mensuel atteint ({st['monthly_spent']:.2f} / {st['monthly_limit']:.2f} €).")
    if "agent_daily_limit" in st:
        if st["agent_daily_limit"] > 0 and st["agent_daily_spent"] >= st["agent_daily_limit"]:
            raise AiBudgetExceeded(f"Budget IA quotidien de l'agent « {agent_key} » atteint.")
        if st["agent_monthly_limit"] > 0 and st["agent_monthly_spent"] >= st["agent_monthly_limit"]:
            raise AiBudgetExceeded(f"Budget IA mensuel de l'agent « {agent_key} » atteint.")


def record(db: Session, agent_key: str, purpose: str, model: str, tin: int, tout: int, cached=False):
    cfg = S.get_all(db)
    c = Decimal("0") if cached else cost_eur(cfg, model, tin, tout)
    db.add(AiUsage(agent_key=agent_key, purpose=purpose, model=model, input_tokens=tin, output_tokens=tout, cost_eur=c, cached=cached))
    db.flush()
    return c


def _text(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def complete(db: Session, *, agent_key: str, purpose: str, system: str, prompt: str, tier="simple", max_tokens=1200,
             cache=True, cache_ttl_days=30) -> dict:
    """Appel simple (sans outils). Retourne {'text', 'cached', 'model'}."""
    cfg = S.get_all(db)
    model = cfg["ai_model_simple"] if tier == "simple" else cfg["ai_model_reasoning"]
    key = hashlib.sha256(json.dumps([model, system, prompt], ensure_ascii=False).encode()).hexdigest()
    if cache:
        hit = db.get(AiCache, key)
        if hit and hit.created_at > now() - timedelta(days=cache_ttl_days):
            record(db, agent_key, purpose, model, 0, 0, cached=True)
            return {"text": hit.response["text"], "cached": True, "model": model}
    check_budget(db, agent_key)
    client = _client(db)
    resp = client.messages.create(model=model, max_tokens=max(max_tokens, 3000), system=system, messages=[{"role": "user", "content": prompt}],
                                  output_config={"effort": "low" if tier == "simple" else "medium"})
    if resp.stop_reason == "refusal":
        raise AiUnavailable("Le modèle a refusé cette requête.")
    text = _text(resp)
    record(db, agent_key, purpose, model, resp.usage.input_tokens, resp.usage.output_tokens)
    if cache:
        row = db.get(AiCache, key)
        if row:
            row.response, row.created_at = {"text": text}, now()
        else:
            db.add(AiCache(key=key, response={"text": text}))
        db.flush()
    return {"text": text, "cached": False, "model": model}


def usage_summary(db: Session) -> dict:
    n = now()
    rows = (db.query(AiUsage.agent_key, func.sum(AiUsage.cost_eur), func.sum(AiUsage.input_tokens + AiUsage.output_tokens), func.count())
            .filter(AiUsage.at >= timez.start_of_month(n)).group_by(AiUsage.agent_key).all())
    cache_hits = db.query(AiUsage).filter(AiUsage.at >= timez.start_of_month(n), AiUsage.cached.is_(True)).count()
    return {"budget": budget_state(db), "by_agent": [{"agent": a, "cost_eur": D(c), "tokens": int(t or 0), "calls": k} for a, c, t, k in rows],
            "cache_hits_month": cache_hits}
