"""Annonces : génération déterministe (sans IA), contrôle de conformité Vinted, amélioration IA optionnelle."""
import math, re, json
from decimal import Decimal
from sqlalchemy.orm import Session
from ..core import profit as P
from ..core.money import D, q2
from ..models import InventoryItem, Listing, Opportunity, PurchaseLine, now
from . import events, settings as S

CONDITIONS = {"new_with_tags": "Neuf avec étiquette", "new_without_tags": "Neuf sans étiquette", "very_good": "Très bon état",
              "good": "Bon état", "satisfactory": "État satisfaisant"}
FORBIDDEN_TERMS = ["réplique", "replique", "contrefaçon", "contrefacon", "copie de", "fake", "inspiré de", "inspire de", "1:1", "type vuitton",
                   "style gucci", "dupe"]
CONTACT_RE = re.compile(r"(https?://|www\.|\b[\w.+-]+@[\w-]+\.[\w.]+|\b0[1-9](?:[\s.-]?\d{2}){4}\b|whatsapp|instagram|snap(?:chat)?)", re.I)


def compliance(db: Session, title: str, description: str, photos: list, price=None) -> dict:
    cfg = S.get_all(db)
    errors, warnings = [], []
    if not title.strip():
        errors.append("Titre vide.")
    if len(title) > int(cfg["vinted_title_max"]):
        errors.append(f"Titre trop long ({len(title)}/{cfg['vinted_title_max']}).")
    if len(description) > int(cfg["vinted_description_max"]):
        errors.append(f"Description trop longue ({len(description)}/{cfg['vinted_description_max']}).")
    text = f"{title} {description}".lower()
    for t in FORBIDDEN_TERMS:
        if t in text:
            errors.append(f"Terme interdit/à risque : « {t} » (contrefaçon/imitation interdites sur Vinted).")
    if CONTACT_RE.search(f"{title} {description}"):
        errors.append("Coordonnées/liens externes détectés : interdits dans une annonce Vinted.")
    real = [p for p in photos if p.is_real_photo]
    if not real:
        errors.append("Aucune photo réelle de l'article : les annonces doivent montrer l'article détenu.")
    elif len(real) < 3:
        warnings.append("Moins de 3 photos réelles : recommandé d'en ajouter (face, dos, détails/étiquette).")
    if photos and not photos[0].is_real_photo:
        errors.append("La photo de couverture doit être une photo réelle (pas un visuel de présentation).")
    if price is not None and D(price) <= 0:
        errors.append("Prix invalide.")
    return {"ok": not errors, "errors": errors, "warnings": warnings}


def suggest_price(db: Session, item: InventoryItem) -> tuple[Decimal, str]:
    cfg = S.get_all(db)
    if item.planned_price and D(item.planned_price) > 0:
        return q2(item.planned_price), "prix de revente prévu à l'achat"
    opp = None
    if item.line_id and (line := db.get(PurchaseLine, item.line_id)) and line.opportunity_id:
        opp = db.get(Opportunity, line.opportunity_id)
    if opp and opp.resale_price:
        return q2(opp.resale_price), f"prix de revente de l'analyse ({opp.resale_basis})"
    cost = D(item.unit_cost) + D(item.extra_cost)
    raw = P.price_for_target_margin(cost, cfg["min_margin_pct"], cfg["seller_fee_rate_pct"], cfg["seller_fee_fixed"])
    return q2(Decimal(math.ceil(raw * 2) / 2)), f"coût + marge minimale de {cfg['min_margin_pct']} % (aucune donnée de marché)"


def generate(db: Session, item: InventoryItem) -> dict:
    cfg = S.get_all(db)
    cond = CONDITIONS.get(item.condition, item.condition)
    parts = [p for p in [item.brand, item.name] if p]
    title = " ".join(parts)
    extras = [x for x in [item.size and f"Taille {item.size}", item.color, cond] if x]
    for e in extras:
        if len(title) + 3 + len(e) <= int(cfg["vinted_title_max"]):
            title += f" - {e}"
    title = title[: int(cfg["vinted_title_max"])]
    lines = [item.name]
    if item.description:
        lines += ["", item.description.strip()]
    lines += ["", "Caractéristiques :"]
    for k, v in (("Marque", item.brand), ("Catégorie", item.category), ("Taille", item.size), ("Couleur", item.color), ("État", cond)):
        if v:
            lines.append(f"• {k} : {v}")
    lines += ["", "Photos réelles de l'article que je détiens.", f"Expédition soignée sous {cfg['shipping_deadline_days']} jours.",
              "N'hésitez pas à poser vos questions via la messagerie Vinted."]
    desc = "\n".join(lines)[: int(cfg["vinted_description_max"])]
    kw = []
    for w in re.findall(r"[\wÀ-ÿ'-]{3,}", " ".join(filter(None, [item.brand, item.name, item.category, item.color]))):
        if w.lower() not in [k.lower() for k in kw]:
            kw.append(w)
    price, basis = suggest_price(db, item)
    tips = ["Photographiez à la lumière naturelle, fond neutre.", "Montrez l'étiquette/composition et les éventuels défauts.",
            "Ajoutez les mesures dans la description si pertinent."]
    if D(item.unit_cost) > 0:
        tips.append(f"Seuil de rentabilité : {P.break_even_price(D(item.unit_cost) + D(item.extra_cost), cfg['seller_fee_rate_pct'], cfg['seller_fee_fixed'])} €.")
    return {"title": title, "description": desc, "price": price, "price_basis": basis, "keywords": kw[:12], "tips": tips,
            "vinted_category": item.category}


def upsert_draft(db: Session, item: InventoryItem, improved: dict | None = None) -> Listing:
    g = generate(db, item)
    if improved:
        g.update({k: v for k, v in improved.items() if v})
    l = (db.query(Listing).filter(Listing.item_id == item.id, Listing.status.in_(["draft", "ready"])).order_by(Listing.id.desc()).first())
    if l is None:
        l = Listing(item_id=item.id, title=g["title"], description=g["description"], price=g["price"], keywords=g["keywords"],
                    tips=g["tips"], vinted_category=g["vinted_category"], status="draft", ai_generated=bool(improved))
        db.add(l)
    else:
        l.title, l.description, l.price, l.keywords, l.tips = g["title"], g["description"], g["price"], g["keywords"], g["tips"]
        l.ai_generated = bool(improved)
    db.flush()
    events.log(db, "listing_prepared", f"Annonce préparée pour « {item.name} » ({l.price} €)", actor="listing_creator", entity="listing", entity_id=l.id)
    return l


def ai_improve(db: Session, item: InventoryItem, base: dict) -> dict:
    """Améliore titre/description avec le modèle économique. Interdit d'inventer des caractéristiques."""
    from . import ai
    system = ("Tu rédiges des annonces Vinted en français, factuelles et attractives. N'invente AUCUNE caractéristique (matière, taille, "
              "marque, état) absente des données. Aucune coordonnée, aucun lien. Réponds en JSON : {\"title\":\"\",\"description\":\"\"}.")
    prompt = json.dumps({"données": {"nom": item.name, "marque": item.brand, "catégorie": item.category, "taille": item.size, "couleur": item.color,
                                     "état": CONDITIONS.get(item.condition), "description": item.description},
                         "brouillon": {"title": base["title"], "description": base["description"]},
                         "limites": {"titre": S.get(db, "vinted_title_max"), "description": S.get(db, "vinted_description_max")}}, ensure_ascii=False)
    out = ai.complete(db, agent_key="listing_creator", purpose="improve_listing", system=system, prompt=prompt, tier="simple", max_tokens=900)
    t = out["text"].strip().strip("`")
    data = json.loads(t[t.index("{"): t.rindex("}") + 1])
    return {"title": str(data.get("title", ""))[: int(S.get(db, "vinted_title_max"))],
            "description": str(data.get("description", ""))[: int(S.get(db, "vinted_description_max"))]}
