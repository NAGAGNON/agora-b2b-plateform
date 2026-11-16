"""Fournisseurs, sources, opportunités, simulateur, achats."""
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func
from ..core import profit as P
from ..core.money import D, q2
from ..db import DB
from ..models import Document, Expense, Opportunity, PriceReference, PurchaseOrder, Source, Supplier, now
from ..serialize import js, ser
from ..services import analysis, documents, events, importer, purchasing, settings as S

router = APIRouter(prefix="/api", tags=["sourcing"])


def nf(db, obj, what):
    if obj is None:
        raise HTTPException(404, f"{what} introuvable")
    return obj


# ---- Fournisseurs ----------------------------------------------------------------------------
class SupplierIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    website: str | None = None
    contact: str | None = None
    kind: str = "grossiste"
    default_shipping: float = 0
    lead_time_days: int | None = None
    notes: str | None = None
    allowed: bool = True


@router.get("/suppliers")
def suppliers(db: DB):
    out = []
    for s in db.query(Supplier).order_by(Supplier.name).all():
        n_opp = db.query(Opportunity).filter_by(supplier_id=s.id).count()
        spent = db.query(func.coalesce(func.sum(Expense.amount), 0)).join(PurchaseOrder, Expense.purchase_order_id == PurchaseOrder.id) \
            .filter(PurchaseOrder.supplier_id == s.id, Expense.voided_at.is_(None)).scalar()
        out.append(ser(s, opportunities=n_opp, total_spent=float(spent), orders=db.query(PurchaseOrder).filter_by(supplier_id=s.id).count(),
                       sources=db.query(Source).filter_by(supplier_id=s.id).count()))
    return out


@router.post("/suppliers")
def create_supplier(b: SupplierIn, db: DB):
    if db.query(Supplier).filter(func.lower(Supplier.name) == b.name.lower()).first():
        raise HTTPException(409, "Un fournisseur porte déjà ce nom.")
    s = Supplier(**b.model_dump())
    db.add(s); db.flush()
    events.log(db, "supplier_created", f"Fournisseur « {s.name} » ajouté", entity="supplier", entity_id=s.id)
    return ser(s)


@router.put("/suppliers/{sid}")
def update_supplier(sid: int, b: SupplierIn, db: DB):
    s = nf(db, db.get(Supplier, sid), "Fournisseur")
    for k, v in b.model_dump().items():
        setattr(s, k, v)
    return ser(s)


@router.delete("/suppliers/{sid}")
def delete_supplier(sid: int, db: DB):
    s = nf(db, db.get(Supplier, sid), "Fournisseur")
    if db.query(PurchaseOrder).filter_by(supplier_id=sid).count():
        raise HTTPException(409, "Ce fournisseur a des commandes : désactivez-le (« autorisé » décoché) plutôt que de le supprimer.")
    db.delete(s)
    return {"ok": True}


# ---- Sources ---------------------------------------------------------------------------------
class SourceIn(BaseModel):
    name: str
    supplier_id: int | None = None
    kind: str = Field(pattern="^(csv_file|csv_url|json_url)$")
    url: str | None = None
    mapping: dict = {}
    json_path: str | None = None
    secret_name: str | None = None
    header_name: str | None = None
    currency_rate: float = 1
    enabled: bool = True


@router.get("/sources")
def sources(db: DB):
    return [ser(s, supplier=s.supplier.name if s.supplier else None, products=db.query(Opportunity).filter_by(source_id=s.id).count())
            for s in db.query(Source).order_by(Source.id).all()]


@router.post("/sources")
def create_source(b: SourceIn, db: DB):
    if b.kind != "csv_file":
        if not b.url:
            raise HTTPException(400, "URL requise pour une source distante.")
        importer.assert_public_url(b.url)
    s = Source(**b.model_dump())
    db.add(s); db.flush()
    events.log(db, "source_created", f"Source « {s.name} » ajoutée ({s.kind})", entity="source", entity_id=s.id)
    return ser(s)


@router.put("/sources/{sid}")
def update_source(sid: int, b: SourceIn, db: DB):
    s = nf(db, db.get(Source, sid), "Source")
    if b.kind != "csv_file" and b.url:
        importer.assert_public_url(b.url)
    for k, v in b.model_dump().items():
        setattr(s, k, v)
    return ser(s)


@router.delete("/sources/{sid}")
def delete_source(sid: int, db: DB):
    db.delete(nf(db, db.get(Source, sid), "Source"))
    return {"ok": True}


@router.post("/sources/{sid}/sync")
def sync(sid: int, db: DB, limit: int | None = None):
    s = nf(db, db.get(Source, sid), "Source")
    try:
        r = importer.sync_source(db, s, limit)
    except importer.ImportError_ as e:
        s.last_status = f"Échec : {e}"[:300]
        db.commit()
        raise HTTPException(400, str(e))
    return r


@router.post("/sources/{sid}/upload")
async def upload_csv(sid: int, db: DB, file: UploadFile = File(...), preview: bool = False):
    s = nf(db, db.get(Source, sid), "Source")
    data = await file.read()
    if len(data) > 20_000_000:
        raise HTTPException(413, "Fichier trop volumineux (> 20 Mo).")
    try:
        cols, rows = importer.parse_csv(data.decode("utf-8-sig", errors="replace"))
    except Exception as e:
        raise HTTPException(400, f"CSV illisible : {e}")
    if preview:
        return {"columns": cols, "suggested_mapping": importer.guess_mapping(cols), "sample": rows[:5], "total_rows": len(rows)}
    try:
        return importer.ingest(db, s, cols, rows)
    except importer.ImportError_ as e:
        raise HTTPException(400, str(e))


# ---- Opportunités ----------------------------------------------------------------------------
def _opp_ser(o: Opportunity, full=False):
    d = ser(o, supplier_name=o.supplier.name if o.supplier else None, total_cost=(o.score_detail or {}).get("total_cost"))
    if full:
        d["references"] = [ser(r) for r in o.references]
    return d


@router.get("/opportunities")
def list_opps(db: DB, q: str | None = None, status: str | None = None, category: str | None = None, supplier_id: int | None = None,
              min_margin: float | None = None, min_profit: float | None = None, min_score: int | None = None,
              min_price: float | None = None, max_price: float | None = None, availability: str | None = None,
              scored: bool | None = None, sort: str = "score", limit: int = 100, offset: int = 0):
    qs = db.query(Opportunity)
    if q:
        qs = qs.filter(Opportunity.name.ilike(f"%{q}%") | Opportunity.brand.ilike(f"%{q}%"))
    if status:
        qs = qs.filter(Opportunity.status == status)
    if category:
        qs = qs.filter(Opportunity.category == category)
    if supplier_id:
        qs = qs.filter(Opportunity.supplier_id == supplier_id)
    if min_margin is not None:
        qs = qs.filter(Opportunity.est_margin_pct >= min_margin)
    if min_profit is not None:
        qs = qs.filter(Opportunity.est_profit >= min_profit)
    if min_score is not None:
        qs = qs.filter(Opportunity.score >= min_score)
    if min_price is not None:
        qs = qs.filter(Opportunity.purchase_price >= min_price)
    if max_price is not None:
        qs = qs.filter(Opportunity.purchase_price <= max_price)
    if availability:
        qs = qs.filter(Opportunity.availability == availability)
    if scored is not None:
        qs = qs.filter(Opportunity.score.isnot(None) if scored else Opportunity.score.is_(None))
    total = qs.count()
    order = {"score": Opportunity.score.desc().nulls_last(), "margin": Opportunity.est_margin_pct.desc().nulls_last(),
             "profit": Opportunity.est_profit.desc().nulls_last(), "price": Opportunity.purchase_price.asc(),
             "recent": Opportunity.id.desc()}.get(sort, Opportunity.score.desc().nulls_last())
    rows = qs.order_by(order, Opportunity.id.desc()).offset(offset).limit(min(limit, 500)).all()
    cats = [c for (c,) in db.query(Opportunity.category).filter(Opportunity.category.isnot(None)).distinct().order_by(Opportunity.category)]
    return js({"total": total, "items": [_opp_ser(o) for o in rows], "categories": cats})


class OppIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    supplier_id: int | None = None
    purchase_price: float = Field(ge=0)
    shipping_cost: float = Field(0, ge=0)
    extra_costs: float = Field(0, ge=0)
    brand: str | None = None
    category: str | None = None
    description: str | None = None
    image_url: str | None = None
    supplier_url: str | None = None
    availability: str = "unknown"
    manual_resale_price: float | None = Field(None, gt=0)
    demand: str | None = None
    competition: str | None = None
    trend: str | None = None
    risk: str | None = None
    compliance: str = "unknown"
    compliance_notes: str | None = None
    notes: str | None = None


@router.post("/opportunities")
def create_opp(b: OppIn, db: DB):
    o = Opportunity(**b.model_dump(), last_checked_at=now())
    db.add(o); db.flush()
    analysis.analyze(db, o)
    events.log(db, "opportunity_new", f"Produit ajouté : « {o.name} »", entity="opportunity", entity_id=o.id)
    return js(_opp_ser(o, True))


@router.get("/opportunities/{oid}")
def get_opp(oid: int, db: DB):
    return js(_opp_ser(nf(db, db.get(Opportunity, oid), "Opportunité"), True))


@router.put("/opportunities/{oid}")
def update_opp(oid: int, b: OppIn, db: DB):
    o = nf(db, db.get(Opportunity, oid), "Opportunité")
    for k, v in b.model_dump().items():
        setattr(o, k, v)
    o.last_checked_at = now()
    analysis.analyze(db, o)
    return js(_opp_ser(o, True))


class StatusIn(BaseModel):
    status: str


@router.post("/opportunities/{oid}/status")
def opp_status(oid: int, b: StatusIn, db: DB):
    o = nf(db, db.get(Opportunity, oid), "Opportunité")
    if b.status not in ("new", "to_study", "recommended", "rejected", "validated"):
        raise HTTPException(400, "Statut invalide.")
    o.status = b.status
    events.log(db, "opportunity_validated" if b.status == "validated" else "opportunity_status", f"« {o.name} » → {b.status}", entity="opportunity", entity_id=o.id)
    return js(_opp_ser(o))


@router.delete("/opportunities/{oid}")
def delete_opp(oid: int, db: DB):
    db.delete(nf(db, db.get(Opportunity, oid), "Opportunité"))
    return {"ok": True}


class RefIn(BaseModel):
    price: float = Field(gt=0)
    kind: str = Field(pattern="^(sold|listed)$")
    note: str | None = None
    url: str | None = None


@router.post("/opportunities/{oid}/references")
def add_ref(oid: int, b: RefIn, db: DB):
    o = nf(db, db.get(Opportunity, oid), "Opportunité")
    o.references.append(PriceReference(**b.model_dump()))
    db.flush()
    analysis.analyze(db, o)
    return js(_opp_ser(o, True))


@router.delete("/opportunities/{oid}/references/{rid}")
def del_ref(oid: int, rid: int, db: DB):
    o = nf(db, db.get(Opportunity, oid), "Opportunité")
    r = db.get(PriceReference, rid)
    if not r or r.opportunity_id != oid:
        raise HTTPException(404, "Référence introuvable")
    o.references.remove(r)
    db.flush()
    analysis.analyze(db, o)
    return js(_opp_ser(o, True))


@router.post("/opportunities/analyze")
def analyze_all(db: DB):
    return analysis.analyze_all(db)


@router.post("/opportunities/{oid}/ai-enrich")
def ai_enrich(oid: int, db: DB):
    o = nf(db, db.get(Opportunity, oid), "Opportunité")
    r = analysis.ai_enrich(db, o)
    return js({**r, "opportunity": _opp_ser(o, True)})


class SimIn(BaseModel):
    purchase_price: float = Field(ge=0)
    resale_price: float = Field(gt=0)
    quantity: int = Field(1, ge=1)
    supplier_shipping: float | None = None
    packaging: float | None = None
    operating: float | None = None
    other: float = 0
    refund_loss: float = 0


@router.post("/simulate")
def simulate(b: SimIn, db: DB):
    cfg = S.get_all(db)
    bs = purchasing.budget_status(db)
    return js(P.simulate(
        purchase_price=b.purchase_price, resale_price=b.resale_price, quantity=b.quantity,
        supplier_shipping=0 if b.supplier_shipping is None else b.supplier_shipping,
        packaging=cfg["default_packaging"] if b.packaging is None else b.packaging,
        operating=cfg["default_operating"] if b.operating is None else b.operating, other=b.other,
        fee_rate_pct=cfg["seller_fee_rate_pct"], fixed_fee=cfg["seller_fee_fixed"], refund_loss=b.refund_loss,
        min_margin_pct=cfg["min_margin_pct"], min_profit=cfg["min_profit"],
        budget_remaining=bs["monthly_remaining"], per_purchase_budget=cfg["budget_per_purchase"] or None))


# ---- Achats ------------------------------------------------------------------------------------
def _po_ser(o: PurchaseOrder):
    return ser(o, supplier_name=o.supplier.name if o.supplier else None, status_label=purchasing.LABELS[o.status],
               lines_total=purchasing.lines_total(o), total=purchasing.order_total(o),
               lines=[ser(l, line_total=q2(D(l.unit_price) * l.quantity)) for l in o.lines],
               editable=o.status in purchasing.EDITABLE, next_statuses=sorted(purchasing.TRANSITIONS[o.status]))


class LineIn(BaseModel):
    name: str
    unit_price: float = Field(ge=0)
    quantity: int = Field(1, ge=1)
    opportunity_id: int | None = None
    category: str | None = None
    brand: str | None = None
    supplier_url: str | None = None
    planned_resale_price: float | None = None


class POIn(BaseModel):
    supplier_id: int | None = None
    lines: list[LineIn] = Field(min_length=1)
    shipping_cost: float = Field(0, ge=0)
    other_fees: float = Field(0, ge=0)
    reference: str | None = None
    supplier_url: str | None = None
    notes: str | None = None
    status: str = "to_study"


@router.get("/purchases")
def list_pos(db: DB, status: str | None = None):
    q = db.query(PurchaseOrder)
    if status:
        q = q.filter(PurchaseOrder.status == status)
    return js({"items": [_po_ser(o) for o in q.order_by(PurchaseOrder.id.desc()).limit(300).all()], "budget": purchasing.budget_status(db),
               "statuses": [{"key": k, "label": v} for k, v in purchasing.LABELS.items()]})


@router.post("/purchases")
def create_po(b: POIn, db: DB):
    if b.status not in ("to_study", "recommended", "awaiting_validation"):
        raise HTTPException(400, "Une commande se crée « à étudier », « recommandée » ou « en attente de validation ».")
    o = purchasing.create_order(db, supplier_id=b.supplier_id, lines=[l.model_dump() for l in b.lines], shipping_cost=b.shipping_cost,
                                other_fees=b.other_fees, reference=b.reference, supplier_url=b.supplier_url, notes=b.notes, status=b.status)
    return js(_po_ser(o))


@router.post("/purchases/from-opportunities")
def po_from_opps(ids: list[int], db: DB, quantity: int = 1):
    opps = db.query(Opportunity).filter(Opportunity.id.in_(ids)).all()
    if not opps:
        raise HTTPException(404, "Aucune opportunité")
    if len({o.supplier_id for o in opps}) > 1:
        raise HTTPException(400, "Choisissez des produits d'un même fournisseur pour une commande.")
    lines = [{"name": o.name, "unit_price": o.purchase_price, "quantity": quantity, "opportunity_id": o.id, "category": o.category, "brand": o.brand,
              "supplier_url": o.supplier_url, "image_url": o.image_url, "planned_resale_price": o.resale_price} for o in opps]
    ship = sum((D(o.shipping_cost) * quantity for o in opps), Decimal("0"))
    return js(_po_ser(purchasing.create_order(db, supplier_id=opps[0].supplier_id, lines=lines, shipping_cost=ship, status="to_study")))


@router.get("/purchases/{pid}")
def get_po(pid: int, db: DB):
    o = nf(db, db.get(PurchaseOrder, pid), "Commande")
    docs = [ser(d, extracted_text=None) for d in db.query(Document).filter(Document.purchase_order_id == pid).all()]
    return js({**_po_ser(o), "documents": docs, "budget_problems": purchasing.check_budget(db, o) if o.status in purchasing.EDITABLE | {"validated"} else []})


@router.put("/purchases/{pid}")
def update_po(pid: int, b: POIn, db: DB):
    o = nf(db, db.get(PurchaseOrder, pid), "Commande")
    if o.status not in purchasing.EDITABLE:
        raise HTTPException(409, "Commande figée : seule une commande non validée peut être modifiée.")
    o.supplier_id, o.shipping_cost, o.other_fees = b.supplier_id, q2(b.shipping_cost), q2(b.other_fees)
    o.reference, o.supplier_url, o.notes = b.reference, b.supplier_url, b.notes
    o.lines.clear()
    db.flush()
    for l in b.lines:
        purchasing.add_line(o, l.model_dump())
    return js(_po_ser(o))


class POStatus(BaseModel):
    status: str
    override_budget: bool = False
    tracking: str | None = None
    reference: str | None = None


@router.post("/purchases/{pid}/status")
def po_status(pid: int, b: POStatus, db: DB):
    o = nf(db, db.get(PurchaseOrder, pid), "Commande")
    purchasing.set_status(db, o, b.status, actor="user", override_budget=b.override_budget, tracking=b.tracking, reference=b.reference)
    return js(_po_ser(o))


@router.delete("/purchases/{pid}")
def delete_po(pid: int, db: DB):
    o = nf(db, db.get(PurchaseOrder, pid), "Commande")
    if o.status not in ("to_study", "recommended", "awaiting_validation", "cancelled"):
        raise HTTPException(409, "Annulez d'abord la commande (écritures comptables conservées).")
    db.delete(o)
    return {"ok": True}


@router.post("/purchases/prepare-baskets")
def prepare(db: DB, limit: int = 5):
    return js(analysis.prepare_baskets(db, limit=min(limit, 20)))


# ---- Import de documents ---------------------------------------------------------------------
@router.post("/documents/analyze")
async def analyze_doc(db: DB, file: UploadFile = File(...)):
    data = await file.read()
    try:
        d = documents.analyze(db, file.filename or "document", data)
    except documents.DocError as e:
        raise HTTPException(400, str(e))
    return {"id": d.id, "kind": d.kind, "parsed": d.parsed, "text_preview": (d.extracted_text or "")[:1500]}


class DocConfirm(BaseModel):
    action: str = Field(pattern="^(expense|order)$")
    supplier_id: int | None = None
    amount: float | None = None
    category: str = "autre"
    description: str | None = None
    reference: str | None = None
    date: datetime | None = None
    shipping_cost: float = 0
    lines: list[LineIn] | None = None
    purchase_order_id: int | None = None


@router.post("/documents/{did}/confirm")
def confirm_doc(did: int, b: DocConfirm, db: DB):
    d = nf(db, db.get(Document, did), "Document")
    if b.action == "expense":
        if not b.amount or b.amount <= 0:
            raise HTTPException(400, "Montant requis.")
        if b.category == "achats_fournisseurs":
            raise HTTPException(400, "Un achat de stock s'enregistre via une commande (action « order »).")
        e = Expense(date=b.date or now(), category=b.category, amount=q2(b.amount), description=b.description or d.filename, document_id=d.id)
        db.add(e); db.flush()
        events.log(db, "expense_imported", f"Dépense importée depuis « {d.filename} » : {e.amount} €", entity="expense", entity_id=e.id)
        return {"expense_id": e.id}
    lines = b.lines or (d.parsed or {}).get("lines")
    if not lines:
        raise HTTPException(400, "Aucune ligne de commande fournie.")
    lines = [l.model_dump() if hasattr(l, "model_dump") else l for l in lines]
    o = purchasing.create_order(db, supplier_id=b.supplier_id, lines=lines, shipping_cost=b.shipping_cost, reference=b.reference,
                                notes=f"Importée depuis {d.filename}", status="to_study")
    # L'utilisateur confirme explicitement un achat déjà réalisé : validation puis « commandée » (aucun paiement n'est déclenché par l'appli).
    o.status = "awaiting_validation"
    purchasing.set_status(db, o, "validated", actor="user", override_budget=True)
    purchasing.set_status(db, o, "ordered", actor="user")
    d.purchase_order_id = o.id
    return js(_po_ser(o))
