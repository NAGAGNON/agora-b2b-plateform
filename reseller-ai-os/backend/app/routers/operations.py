"""Stock, photos, annonces, Vinted, ventes, expéditions."""
import io, zipfile
from datetime import datetime
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import object_session
from ..core.money import D, q2
from ..db import DB
from ..models import InventoryItem, ItemPhoto, Listing, Sale, Shipment, ShipmentEvent, VintedIncident, now
from ..serialize import js, ser
from ..services import events, inventory as inv, listing as listing_svc, photos, sales as sales_svc, storage, vinted

router = APIRouter(prefix="/api", tags=["operations"])


def nf(obj, what):
    if obj is None:
        raise HTTPException(404, f"{what} introuvable")
    return obj


# ---- Stock -------------------------------------------------------------------------------------
def _item(i: InventoryItem, full=False):
    cost = q2(D(i.unit_cost) + D(i.extra_cost))
    planned = i.listing_price or i.planned_price
    d = ser(i, status_label=inv.LABELS[i.status], total_cost=cost, in_stock=inv.is_in_stock(i), supplier_name=i.supplier.name if i.supplier else None,
            potential_profit=q2(D(planned) - cost) if planned else None, cover=(f"/api/photos/{i.photos[0].id}/file" if i.photos else None),
            photo_count=len(i.photos), next_statuses=sorted(inv.TRANSITIONS.get(i.status, [])))
    if full:
        d["photos"] = [ser(p, url=f"/api/photos/{p.id}/file") for p in i.photos]
    return d


@router.get("/inventory")
def list_items(db: DB, status: str | None = None, q: str | None = None, in_stock: bool | None = None, limit: int = 200, offset: int = 0):
    qs = db.query(InventoryItem)
    if status:
        qs = qs.filter(InventoryItem.status == status)
    if q:
        qs = qs.filter(InventoryItem.name.ilike(f"%{q}%") | InventoryItem.sku.ilike(f"%{q}%"))
    if in_stock is not None:
        qs = qs.filter(InventoryItem.status.in_(list(inv.IN_STOCK))) if in_stock else qs.filter(~InventoryItem.status.in_(list(inv.IN_STOCK)))
    counts = dict(db.query(InventoryItem.status, func.count()).group_by(InventoryItem.status).all())
    return js({"total": qs.count(), "items": [_item(i) for i in qs.order_by(InventoryItem.id.desc()).offset(offset).limit(min(limit, 500)).all()],
               "counts": counts, "statuses": [{"key": k, "label": inv.LABELS[k]} for k in inv.STATUSES]})


class ItemIn(BaseModel):
    name: str = Field(min_length=1)
    brand: str | None = None
    category: str | None = None
    size: str | None = None
    color: str | None = None
    description: str | None = None
    condition: str = "new_with_tags"
    supplier_id: int | None = None
    purchase_price: float = Field(0, ge=0)
    unit_cost: float | None = Field(None, ge=0)
    extra_cost: float = Field(0, ge=0)
    location: str | None = None
    planned_price: float | None = None


@router.post("/inventory")
def create_item(b: ItemIn, db: DB):
    """Entrée de stock manuelle (article déjà détenu, hors commande fournisseur). Statut « reçu »."""
    i = InventoryItem(sku=inv.next_sku(db), **{**b.model_dump(), "unit_cost": b.purchase_price if b.unit_cost is None else b.unit_cost},
                      status="received", received_at=now(), purchase_date=now())
    db.add(i); db.flush()
    events.log(db, "item_added", f"Article ajouté au stock : « {i.name} »", entity="item", entity_id=i.id)
    return js(_item(i, True))


@router.get("/inventory/{iid}")
def get_item(iid: int, db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    lst = db.query(Listing).filter(Listing.item_id == iid).order_by(Listing.id.desc()).all()
    sale = db.query(Sale).filter(Sale.item_id == iid).order_by(Sale.id.desc()).first()
    return js({**_item(i, True), "listings": [ser(l) for l in lst], "sale": ser(sale) if sale else None, "photo_capabilities": photos.CAPABILITIES})


@router.put("/inventory/{iid}")
def update_item(iid: int, b: ItemIn, db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    if i.order_id and b.unit_cost is not None and D(b.unit_cost) != D(i.unit_cost):
        raise HTTPException(409, "Le coût d'un article issu d'une commande est calculé (achat + frais répartis) et n'est pas modifiable.")
    data = b.model_dump(exclude={"unit_cost", "purchase_price"} if i.order_id else {"unit_cost"})
    if not i.order_id and b.unit_cost is not None:
        data["unit_cost"] = b.unit_cost
    for k, v in data.items():
        setattr(i, k, v)
    return js(_item(i, True))


class ItemStatus(BaseModel):
    status: str


@router.post("/inventory/{iid}/status")
def item_status(iid: int, b: ItemStatus, db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    if b.status in ("sold", "shipped", "done"):
        raise HTTPException(400, "Ces statuts découlent d'une vente : enregistrez la vente.")
    inv.transition(i, b.status)
    events.log(db, "item_status", f"« {i.name} » → {inv.LABELS[i.status]}", entity="item", entity_id=i.id)
    return js(_item(i))


@router.delete("/inventory/{iid}")
def delete_item(iid: int, db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    if i.order_id or db.query(Sale).filter_by(item_id=iid).count():
        raise HTTPException(409, "Article lié à une commande ou à une vente : suppression refusée (comptabilité).")
    for p in list(i.photos):
        photos.delete_photo(db, p)
    db.delete(i)
    return {"ok": True}


# ---- Photos ------------------------------------------------------------------------------------
@router.post("/inventory/{iid}/photos")
async def upload_photo(iid: int, db: DB, file: UploadFile = File(...), label: str | None = Form(None)):
    i = nf(db.get(InventoryItem, iid), "Article")
    try:
        p = photos.add_photo(db, i, await file.read(), label)
    except photos.PhotoError as e:
        raise HTTPException(400, str(e))
    if i.status == "received":
        inv.transition(i, "to_photograph")
    return ser(p, url=f"/api/photos/{p.id}/file")


@router.get("/photos/{pid}/file")
def photo_file(pid: int, db: DB):
    p = nf(db.get(ItemPhoto, pid), "Photo")
    try:
        data = storage.get(p.path)
    except storage.StorageError as e:
        raise HTTPException(404, str(e))
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


class EditIn(BaseModel):
    rotate: int = 0
    crop: list[float] | None = None
    brightness: float = 1.0
    contrast: float = 1.0
    color: float = 1.0
    auto: bool = False


@router.post("/photos/{pid}/edit")
def edit_photo(pid: int, b: EditIn, db: DB):
    p = nf(db.get(ItemPhoto, pid), "Photo")
    try:
        n = photos.edit_photo(db, p.item_id and db.get(InventoryItem, p.item_id), p, rotate=b.rotate, crop=b.crop, brightness=b.brightness,
                              contrast=b.contrast, color=b.color, auto=b.auto)
    except photos.PhotoError as e:
        raise HTTPException(400, str(e))
    return ser(n, url=f"/api/photos/{n.id}/file")


class PresIn(BaseModel):
    text: str | None = None


@router.post("/photos/{pid}/presentation")
def presentation(pid: int, b: PresIn, db: DB):
    p = nf(db.get(ItemPhoto, pid), "Photo")
    n = photos.presentation_visual(db, db.get(InventoryItem, p.item_id), p, b.text)
    return ser(n, url=f"/api/photos/{n.id}/file")


@router.post("/inventory/{iid}/photos/reorder")
def reorder(iid: int, ids: list[int], db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    try:
        photos.reorder(db, i, ids)
    except photos.PhotoError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.delete("/photos/{pid}")
def del_photo(pid: int, db: DB):
    photos.delete_photo(db, nf(db.get(ItemPhoto, pid), "Photo"))
    return {"ok": True}


@router.get("/inventory/{iid}/photos.zip")
def photos_zip(iid: int, db: DB):
    i = nf(db.get(InventoryItem, iid), "Article")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for n, p in enumerate(i.photos, 1):
            z.writestr(f"{i.sku}_{n:02d}.jpg", storage.get(p.path))
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{i.sku}.zip"'})


# ---- Annonces ----------------------------------------------------------------------------------
def _listing(l: Listing):
    chk = listing_svc.compliance(object_session(l), l.title, l.description, l.item.photos, l.price)
    return ser(l, item_name=l.item.name, sku=l.item.sku, compliance=chk, cover=(f"/api/photos/{l.item.photos[0].id}/file" if l.item.photos else None))


@router.get("/listings")
def list_listings(db: DB, status: str | None = None):
    q = db.query(Listing)
    if status:
        q = q.filter(Listing.status == status)
    return js([_listing(l) for l in q.order_by(Listing.id.desc()).limit(300).all()])


@router.post("/inventory/{iid}/listing")
def prepare_listing(iid: int, db: DB, improve_with_ai: bool = False):
    i = nf(db.get(InventoryItem, iid), "Article")
    if not inv.is_in_stock(i):
        raise HTTPException(409, "Article non disponible en stock : impossible de préparer une annonce.")
    improved = None
    if improve_with_ai:
        from ..services import ai
        try:
            improved = listing_svc.ai_improve(db, i, listing_svc.generate(db, i))
        except (ai.AiUnavailable, ai.AiBudgetExceeded) as e:
            raise HTTPException(503 if isinstance(e, ai.AiUnavailable) else 429, str(e))
    return js(_listing(listing_svc.upsert_draft(db, i, improved)))


@router.get("/listings/{lid}")
def get_listing(lid: int, db: DB):
    l = nf(db.get(Listing, lid), "Annonce")
    return js({**_listing(l), "pack": vinted.publication_pack(db, l), "item": _item(l.item, True)})


class ListingIn(BaseModel):
    title: str
    description: str
    price: float = Field(gt=0)
    vinted_category: str | None = None
    keywords: list[str] = []


@router.put("/listings/{lid}")
def update_listing(lid: int, b: ListingIn, db: DB):
    l = nf(db.get(Listing, lid), "Annonce")
    if l.status in ("sold", "removed"):
        raise HTTPException(409, "Annonce clôturée.")
    l.title, l.description, l.price, l.keywords, l.vinted_category = b.title, b.description, q2(b.price), b.keywords, b.vinted_category
    l.ai_generated = False
    if l.status == "ready":
        l.status = "draft"
    return js(_listing(l))


@router.post("/listings/{lid}/ready")
def listing_ready(lid: int, db: DB):
    l = nf(db.get(Listing, lid), "Annonce")
    vinted.mark_ready(db, l)
    return js(_listing(l))


class PublishedIn(BaseModel):
    url: str


@router.post("/listings/{lid}/published")
def listing_published(lid: int, b: PublishedIn, db: DB):
    l = nf(db.get(Listing, lid), "Annonce")
    vinted.confirm_published(db, l, b.url.strip())
    return js(_listing(l))


@router.post("/listings/{lid}/remove")
def listing_remove(lid: int, db: DB):
    l = nf(db.get(Listing, lid), "Annonce")
    if l.status == "sold":
        raise HTTPException(409, "Annonce vendue.")
    l.status = "removed"
    if l.item.status == "published":
        inv.transition(l.item, "ready")
        l.item.listing_url = None
    events.log(db, "listing_removed", f"Annonce retirée : « {l.item.name} »", entity="listing", entity_id=l.id)
    return js(_listing(l))


# ---- Vinted ------------------------------------------------------------------------------------
@router.get("/vinted")
def vinted_home(db: DB):
    a = vinted.account(db)
    counts = dict(db.query(Listing.status, func.count()).group_by(Listing.status).all())
    to_publish = db.query(InventoryItem).filter(InventoryItem.status.in_(["received", "to_photograph", "ready"])).count()
    return js({"account": ser(a), "connector": vinted.connector_status(db), "listing_counts": counts, "items_to_publish": to_publish,
               "incidents": [ser(i) for i in db.query(VintedIncident).order_by(VintedIncident.id.desc()).limit(50).all()],
               "published": [_listing(l) for l in db.query(Listing).filter_by(status="published").order_by(Listing.published_at.desc()).limit(100).all()]})


class AccountIn(BaseModel):
    username: str | None = None
    profile_url: str | None = None
    mode: str = Field("assisted", pattern="^(assisted|api)$")
    api_status: str = Field("not_granted", pattern="^(not_granted|requested|granted)$")
    api_base_url: str | None = None
    notes: str | None = None


@router.put("/vinted/account")
def update_account(b: AccountIn, db: DB):
    a = vinted.account(db)
    for k, v in b.model_dump().items():
        setattr(a, k, v)
    return js({"account": ser(a), "connector": vinted.connector_status(db)})


@router.post("/vinted/api/sync")
def api_sync(db: DB):
    try:
        vinted.require_api(db)
    except vinted.VintedError as e:
        raise HTTPException(409, str(e))


class IncidentIn(BaseModel):
    kind: str = Field(pattern="^(litige|retour|colis_perdu|annonce_refusee|autre)$")
    description: str = Field(min_length=3)
    sale_id: int | None = None
    item_id: int | None = None


@router.post("/vinted/incidents")
def create_incident(b: IncidentIn, db: DB):
    i = VintedIncident(**b.model_dump())
    db.add(i); db.flush()
    events.log(db, "incident_created", f"Incident Vinted ({b.kind}) : {b.description[:80]}", entity="incident", entity_id=i.id)
    events.notify(db, "incident", "Incident Vinted ouvert", b.description[:200], severity="warning", link="/vinted", dedupe_key=f"incident-{i.id}")
    return ser(i)


@router.post("/vinted/incidents/{iid}/resolve")
def resolve_incident(iid: int, db: DB):
    i = nf(db.get(VintedIncident, iid), "Incident")
    i.status, i.resolved_at = "resolved", now()
    return ser(i)


# ---- Ventes ------------------------------------------------------------------------------------
def _sale(s: Sale, full=False):
    f = sales_svc.figures(s)
    d = ser(s, status_label=sales_svc.LABELS[s.status], item_name=s.item.name, sku=s.item.sku, figures=f, profit=f["profit"], margin_pct=f["margin_pct"],
            next_statuses=sorted(sales_svc.TRANSITIONS[s.status]),
            shipment=ser(s.shipment, events=[ser(e) for e in s.shipment.events]) if s.shipment else None)
    return d


@router.get("/sales")
def list_sales(db: DB, status: str | None = None, limit: int = 200):
    q = db.query(Sale)
    if status:
        q = q.filter(Sale.status == status)
    return js({"items": [_sale(s) for s in q.order_by(Sale.sold_at.desc()).limit(min(limit, 500)).all()],
               "statuses": [{"key": k, "label": v} for k, v in sales_svc.LABELS.items()]})


class SaleIn(BaseModel):
    item_id: int
    sale_price: float = Field(gt=0)
    sold_at: datetime | None = None
    order_ref: str | None = None
    listing_url: str | None = None
    seller_fees: float | None = Field(None, ge=0)
    shipping_cost: float = Field(0, ge=0)
    packaging_cost: float | None = Field(None, ge=0)
    payment_confirmed: bool = False


@router.post("/sales")
def create_sale(b: SaleIn, db: DB):
    from ..services import settings as S
    pack = S.get(db, "default_packaging") if b.packaging_cost is None else b.packaging_cost
    s = sales_svc.create_sale(db, item_id=b.item_id, sale_price=b.sale_price, sold_at=b.sold_at, order_ref=b.order_ref, listing_url=b.listing_url,
                              seller_fees=b.seller_fees, shipping_cost=b.shipping_cost, packaging_cost=pack, payment_confirmed=b.payment_confirmed)
    return js(_sale(s))


@router.get("/sales/{sid}")
def get_sale(sid: int, db: DB):
    return js(_sale(nf(db.get(Sale, sid), "Vente")))


class SaleCosts(BaseModel):
    seller_fees: float | None = Field(None, ge=0)
    shipping_cost: float | None = Field(None, ge=0)
    packaging_cost: float | None = Field(None, ge=0)
    order_ref: str | None = None
    notes: str | None = None


@router.put("/sales/{sid}")
def update_sale(sid: int, b: SaleCosts, db: DB):
    s = nf(db.get(Sale, sid), "Vente")
    sales_svc.update_costs(db, s, **b.model_dump())
    return js(_sale(s))


class SaleStatus(BaseModel):
    status: str
    refund_amount: float | None = None
    restock: bool = False
    tracking: str | None = None
    carrier: str | None = None


@router.post("/sales/{sid}/status")
def sale_status(sid: int, b: SaleStatus, db: DB):
    s = nf(db.get(Sale, sid), "Vente")
    sales_svc.set_status(db, s, b.status, refund_amount=b.refund_amount, restock=b.restock, tracking=b.tracking, carrier=b.carrier)
    return js(_sale(s))


class PayoutIn(BaseModel):
    received_at: datetime | None = None


@router.post("/sales/{sid}/payout")
def payout(sid: int, b: PayoutIn, db: DB):
    s = nf(db.get(Sale, sid), "Vente")
    sales_svc.record_payout(db, s, b.received_at)
    return js(_sale(s))


# ---- Expéditions -------------------------------------------------------------------------------
@router.get("/shipments")
def list_shipments(db: DB, scope: str = "open"):
    q = db.query(Shipment).join(Sale)
    if scope == "open":
        q = q.filter(Shipment.status.in_(["to_prepare", "label_ready", "shipped", "in_transit", "problem"]), Sale.status != "cancelled")
    out = []
    for sh in q.order_by(Shipment.deadline).limit(300).all():
        late = bool(sh.deadline and sh.deadline < now() and sh.status in ("to_prepare", "label_ready"))
        out.append(ser(sh, item_name=sh.sale.item.name, sale_id=sh.sale_id, sale_price=sh.sale.sale_price, late=late, events=[ser(e) for e in sh.events],
                       order_ref=sh.sale.order_ref, sale_status=sh.sale.status))
    return js(out)


class ShipIn(BaseModel):
    carrier: str | None = None
    tracking_number: str | None = None
    status: str | None = Field(None, pattern="^(to_prepare|label_ready|in_transit|problem)$")
    note: str | None = None
    deadline: datetime | None = None


@router.put("/shipments/{shid}")
def update_shipment(shid: int, b: ShipIn, db: DB):
    sh = nf(db.get(Shipment, shid), "Expédition")
    if b.carrier is not None:
        sh.carrier = b.carrier
    if b.tracking_number is not None:
        sh.tracking_number = b.tracking_number
    if b.deadline:
        sh.deadline = b.deadline
    if b.status:
        sh.status = b.status
        sh.events.append(ShipmentEvent(status=b.status, note=b.note))
    elif b.note:
        sh.events.append(ShipmentEvent(status=sh.status, note=b.note))
    return js(ser(sh, events=[ser(e) for e in sh.events]))
