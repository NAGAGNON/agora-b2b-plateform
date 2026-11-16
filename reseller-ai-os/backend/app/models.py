"""Modèle de données. Montants en NUMERIC(12,2) ; dates en UTC."""
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, Index, LargeBinary)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

Money = Numeric(12, 2)


def now() -> datetime:
    return datetime.now(timezone.utc)


def _dt(**kw):
    return mapped_column(DateTime(timezone=True), **kw)


class AppSetting(Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class Secret(Base):
    """Clés API chiffrées (Fernet). La valeur en clair n'est jamais renvoyée par l'API."""
    __tablename__ = "secrets"
    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)
    last4: Mapped[str] = mapped_column(String(8), default="")
    updated_at: Mapped[datetime] = _dt(default=now, onupdate=now)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    website: Mapped[str | None] = mapped_column(String(500))
    contact: Mapped[str | None] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(40), default="grossiste")  # grossiste, seconde_main, marketplace, autre
    default_shipping: Mapped[Decimal] = mapped_column(Money, default=0)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = _dt(default=now)


class Source(Base):
    """Source de catalogue : fichier CSV importé, CSV/JSON distant autorisé. Pas de scraping."""
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(20))  # csv_file | csv_url | json_url
    url: Mapped[str | None] = mapped_column(String(1000))
    mapping: Mapped[dict] = mapped_column(JSON, default=dict)  # champ interne -> colonne source
    json_path: Mapped[str | None] = mapped_column(String(200))  # chemin vers la liste d'articles dans un JSON
    header_name: Mapped[str | None] = mapped_column(String(80))  # nom du secret d'auth éventuel (en-tête)
    secret_name: Mapped[str | None] = mapped_column(String(80))
    currency_rate: Mapped[Decimal] = mapped_column(Numeric(10, 5), default=1)  # conversion vers EUR
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = _dt(nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(300))
    last_count: Mapped[int | None] = mapped_column(Integer)
    supplier = relationship("Supplier")


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (UniqueConstraint("source_id", "external_ref", name="uq_opp_source_ref"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))
    external_ref: Mapped[str | None] = mapped_column(String(300))
    name: Mapped[str] = mapped_column(String(300))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    brand: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    supplier_url: Mapped[str | None] = mapped_column(String(1000))
    availability: Mapped[str] = mapped_column(String(20), default="unknown")  # in_stock|out_of_stock|unknown
    purchase_price: Mapped[Decimal] = mapped_column(Money)
    shipping_cost: Mapped[Decimal] = mapped_column(Money, default=0)
    extra_costs: Mapped[Decimal] = mapped_column(Money, default=0)
    last_checked_at: Mapped[datetime | None] = _dt(nullable=True)
    # Données de marché — renseignées par l'utilisateur ou estimées, jamais inventées
    manual_resale_price: Mapped[Decimal | None] = mapped_column(Money)
    ai_resale_estimate: Mapped[Decimal | None] = mapped_column(Money)  # estimation IA, jamais comptée comme observée
    demand: Mapped[str | None] = mapped_column(String(10))
    competition: Mapped[str | None] = mapped_column(String(10))
    trend: Mapped[str | None] = mapped_column(String(10))
    risk: Mapped[str | None] = mapped_column(String(10))
    compliance: Mapped[str] = mapped_column(String(12), default="unknown")  # ok|review|forbidden|unknown
    compliance_notes: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    # Résultat d'analyse (calculé par le moteur déterministe)
    resale_price: Mapped[Decimal | None] = mapped_column(Money)
    resale_basis: Mapped[str | None] = mapped_column(String(40))
    est_profit: Mapped[Decimal | None] = mapped_column(Money)
    est_margin_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    score: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[int | None] = mapped_column(Integer)
    score_detail: Mapped[dict | None] = mapped_column(JSON)
    analyzed_at: Mapped[datetime | None] = _dt(nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new|to_study|recommended|validated|rejected|purchased
    created_at: Mapped[datetime] = _dt(default=now)
    supplier = relationship("Supplier")
    references = relationship("PriceReference", cascade="all, delete-orphan", back_populates="opportunity")


class PriceReference(Base):
    """Prix observés manuellement (ventes / annonces Vinted comparables). Source de vérité du prix de revente."""
    __tablename__ = "price_references"
    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"))
    price: Mapped[Decimal] = mapped_column(Money)
    kind: Mapped[str] = mapped_column(String(10))  # sold|listed
    note: Mapped[str | None] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(String(1000))
    observed_at: Mapped[datetime] = _dt(default=now)
    opportunity = relationship("Opportunity", back_populates="references")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str | None] = mapped_column(String(120))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(24), default="to_study")
    shipping_cost: Mapped[Decimal] = mapped_column(Money, default=0)
    other_fees: Mapped[Decimal] = mapped_column(Money, default=0)
    supplier_url: Mapped[str | None] = mapped_column(String(1000))
    tracking_number: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    auto_prepared: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[datetime | None] = _dt(nullable=True)
    ordered_at: Mapped[datetime | None] = _dt(nullable=True)
    shipped_at: Mapped[datetime | None] = _dt(nullable=True)
    received_at: Mapped[datetime | None] = _dt(nullable=True)
    created_at: Mapped[datetime] = _dt(default=now)
    supplier = relationship("Supplier")
    lines = relationship("PurchaseLine", cascade="all, delete-orphan", back_populates="order", order_by="PurchaseLine.id")


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(120))
    brand: Mapped[str | None] = mapped_column(String(120))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    supplier_url: Mapped[str | None] = mapped_column(String(1000))
    unit_price: Mapped[Decimal] = mapped_column(Money)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    planned_resale_price: Mapped[Decimal | None] = mapped_column(Money)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0)
    order = relationship("PurchaseOrder", back_populates="lines")


class InventoryItem(Base):
    """Une ligne = une unité physique (une annonce Vinted = un article)."""
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    brand: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(120))
    size: Mapped[str | None] = mapped_column(String(40))
    color: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(Text)
    condition: Mapped[str] = mapped_column(String(30), default="new_with_tags")
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    line_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_lines.id", ondelete="SET NULL"))
    purchase_date: Mapped[datetime | None] = _dt(nullable=True)
    purchase_price: Mapped[Decimal] = mapped_column(Money, default=0)
    unit_cost: Mapped[Decimal] = mapped_column(Money, default=0)  # coût complet (achat + part des frais de commande)
    extra_cost: Mapped[Decimal] = mapped_column(Money, default=0)  # emballage / frais propres à l'article
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="ordered")
    received_at: Mapped[datetime | None] = _dt(nullable=True)
    location: Mapped[str | None] = mapped_column(String(120))
    planned_price: Mapped[Decimal | None] = mapped_column(Money)
    listing_price: Mapped[Decimal | None] = mapped_column(Money)
    listing_url: Mapped[str | None] = mapped_column(String(1000))
    published_at: Mapped[datetime | None] = _dt(nullable=True)
    created_at: Mapped[datetime] = _dt(default=now)
    supplier = relationship("Supplier")
    photos = relationship("ItemPhoto", cascade="all, delete-orphan", order_by="ItemPhoto.position")
    __table_args__ = (Index("ix_inv_status", "status"),)


class ItemPhoto(Base):
    __tablename__ = "item_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(String(400))
    kind: Mapped[str] = mapped_column(String(20), default="real")  # real | edited | presentation
    is_real_photo: Mapped[bool] = mapped_column(Boolean, default=True)
    label: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = _dt(default=now)


class Listing(Base):
    __tablename__ = "listings"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    vinted_category: Mapped[str | None] = mapped_column(String(200))
    price: Mapped[Decimal] = mapped_column(Money)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    tips: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|ready|published|sold|removed
    mode: Mapped[str] = mapped_column(String(10), default="assisted")  # assisted|api
    vinted_url: Mapped[str | None] = mapped_column(String(1000))
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = _dt(nullable=True)
    created_at: Mapped[datetime] = _dt(default=now)
    updated_at: Mapped[datetime] = _dt(default=now, onupdate=now)
    item = relationship("InventoryItem")


class Sale(Base):
    __tablename__ = "sales"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id", ondelete="SET NULL"))
    order_ref: Mapped[str | None] = mapped_column(String(120))
    listing_url: Mapped[str | None] = mapped_column(String(1000))
    sale_price: Mapped[Decimal] = mapped_column(Money)
    sold_at: Mapped[datetime] = _dt(default=now)
    item_cost: Mapped[Decimal] = mapped_column(Money)  # coût figé à la vente
    seller_fees: Mapped[Decimal] = mapped_column(Money, default=0)
    shipping_cost: Mapped[Decimal] = mapped_column(Money, default=0)
    packaging_cost: Mapped[Decimal] = mapped_column(Money, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    restocked: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="detected")
    payment_status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|confirmed|paid_out|refunded
    delivery_status: Mapped[str] = mapped_column(String(14), default="to_ship")  # to_ship|shipped|delivered
    payout_received_at: Mapped[datetime | None] = _dt(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _dt(default=now)
    item = relationship("InventoryItem")
    shipment = relationship("Shipment", uselist=False, cascade="all, delete-orphan", back_populates="sale")


class Shipment(Base):
    __tablename__ = "shipments"
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), unique=True)
    deadline: Mapped[datetime | None] = _dt(nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(80))
    tracking_number: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), default="to_prepare")  # to_prepare|label_ready|shipped|in_transit|delivered|problem
    shipped_at: Mapped[datetime | None] = _dt(nullable=True)
    delivered_at: Mapped[datetime | None] = _dt(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)
    sale = relationship("Sale", back_populates="shipment")
    events = relationship("ShipmentEvent", cascade="all, delete-orphan", order_by="ShipmentEvent.at")


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"))
    at: Mapped[datetime] = _dt(default=now)
    status: Mapped[str] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(String(300))


class Expense(Base):
    """Journal de caisse (sorties d'argent). purchase_order_id => achat de stock (capitalisé, pas une charge) ;
    sale_id => coût de vente (déjà dans le bénéfice de la vente) ; sinon charge d'exploitation."""
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[datetime] = _dt(default=now)
    category: Mapped[str] = mapped_column(String(30))
    amount: Mapped[Decimal] = mapped_column(Money)
    description: Mapped[str | None] = mapped_column(String(400))
    vendor: Mapped[str | None] = mapped_column(String(160))
    purchase_order_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id", ondelete="SET NULL"))
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    auto: Mapped[bool] = mapped_column(Boolean, default=False)
    voided_at: Mapped[datetime | None] = _dt(nullable=True)
    created_at: Mapped[datetime] = _dt(default=now)
    __table_args__ = (Index("ix_exp_date", "date"),)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    path: Mapped[str] = mapped_column(String(400))
    kind: Mapped[str] = mapped_column(String(10))  # pdf|csv|email|text
    extracted_text: Mapped[str | None] = mapped_column(Text)
    parsed: Mapped[dict | None] = mapped_column(JSON)
    purchase_order_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _dt(default=now)


class VintedAccount(Base):
    __tablename__ = "vinted_account"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str | None] = mapped_column(String(120))
    profile_url: Mapped[str | None] = mapped_column(String(500))
    mode: Mapped[str] = mapped_column(String(10), default="assisted")
    api_status: Mapped[str] = mapped_column(String(20), default="not_granted")  # not_granted|requested|granted
    api_base_url: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)


class VintedIncident(Base):
    __tablename__ = "vinted_incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30))  # litige|retour|colis_perdu|annonce_refusee|autre
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id", ondelete="SET NULL"))
    item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id", ondelete="SET NULL"))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open")
    created_at: Mapped[datetime] = _dt(default=now)
    resolved_at: Mapped[datetime | None] = _dt(nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(10), default="info")  # info|success|warning|danger
    link: Mapped[str | None] = mapped_column(String(200))
    dedupe_key: Mapped[str | None] = mapped_column(String(160), unique=True)
    read_at: Mapped[datetime | None] = _dt(nullable=True)
    emailed_at: Mapped[datetime | None] = _dt(nullable=True)
    created_at: Mapped[datetime] = _dt(default=now)


class ActivityLog(Base):
    """Journal d'audit + timeline. actor : user | system | ai | <agent_key>."""
    __tablename__ = "activity_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = _dt(default=now)
    actor: Mapped[str] = mapped_column(String(40), default="user")
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str | None] = mapped_column(String(40))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(String(400))
    payload: Mapped[dict | None] = mapped_column(JSON)
    __table_args__ = (Index("ix_act_at", "at"),)


class Agent(Base):
    __tablename__ = "agents"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    mission: Mapped[str] = mapped_column(Text)
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(12), default="idle")  # idle|running|error|disabled
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    uses_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_budget_daily: Mapped[Decimal] = mapped_column(Money, default=0)
    ai_budget_monthly: Mapped[Decimal] = mapped_column(Money, default=0)
    last_run_at: Mapped[datetime | None] = _dt(nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text)


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    agent_key: Mapped[str] = mapped_column(ForeignKey("agents.key", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|running|done|error
    trigger: Mapped[str] = mapped_column(String(20), default="manual")  # manual|schedule|message|ai
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _dt(default=now)
    started_at: Mapped[datetime | None] = _dt(nullable=True)
    finished_at: Mapped[datetime | None] = _dt(nullable=True)
    __table_args__ = (Index("ix_task_agent", "agent_key", "created_at"),)


class AgentMessage(Base):
    """Passation entre agents. dedupe_key empêche qu'un même fait soit traité deux fois."""
    __tablename__ = "agent_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    from_agent: Mapped[str] = mapped_column(String(40))
    to_agent: Mapped[str] = mapped_column(String(40))
    subject: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    dedupe_key: Mapped[str | None] = mapped_column(String(160), unique=True)
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending|handled|error
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _dt(default=now)
    handled_at: Mapped[datetime | None] = _dt(nullable=True)


class AutomationJob(Base):
    __tablename__ = "automation_jobs"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    agent_key: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(200))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    schedule_type: Mapped[str] = mapped_column(String(10), default="daily")  # daily|interval
    hour: Mapped[int] = mapped_column(Integer, default=8)
    minute: Mapped[int] = mapped_column(Integer, default=0)
    days: Mapped[str] = mapped_column(String(30), default="mon,tue,wed,thu,fri,sat,sun")
    interval_minutes: Mapped[int | None] = mapped_column(Integer)
    last_run_at: Mapped[datetime | None] = _dt(nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(300))


class AiUsage(Base):
    __tablename__ = "ai_usage"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = _dt(default=now)
    agent_key: Mapped[str] = mapped_column(String(40))
    purpose: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(60))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_eur: Mapped[Decimal] = mapped_column(Numeric(12, 5), default=0)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (Index("ix_ai_at", "at"),)


class AiCache(Base):
    __tablename__ = "ai_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = _dt(default=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="Nouvelle conversation")
    created_at: Mapped[datetime] = _dt(default=now)
    messages = relationship("ConversationMessage", cascade="all, delete-orphan", order_by="ConversationMessage.id")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[list] = mapped_column(JSON)  # blocs au format API Anthropic (texte / tool_use / tool_result)
    created_at: Mapped[datetime] = _dt(default=now)
