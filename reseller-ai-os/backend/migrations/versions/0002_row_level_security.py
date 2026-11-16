"""Active la sécurité par ligne (RLS) sur toutes les tables, sans politique.

Sur Supabase, les tables du schéma public sont exposées par l'API REST avec la clé publique : sans RLS, n'importe qui
pourrait les lire. L'application se connecte avec le rôle propriétaire (qui contourne la RLS) ; l'API REST publique
n'a, elle, accès à rien. Sans effet gênant sur un PostgreSQL ordinaire.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = ["activity_log", "agent_messages", "agent_tasks", "agents", "ai_cache", "ai_usage", "app_settings", "automation_jobs",
          "conversation_messages", "conversations", "documents", "expenses", "inventory_items", "item_photos", "listings",
          "notifications", "opportunities", "price_references", "purchase_lines", "purchase_orders", "sales", "secrets",
          "shipment_events", "shipments", "sources", "suppliers", "vinted_account", "vinted_incidents", "alembic_version"]


def upgrade():
    for t in TABLES:
        op.execute(sa.text(f'ALTER TABLE "{t}" ENABLE ROW LEVEL SECURITY'))


def downgrade():
    for t in TABLES:
        op.execute(sa.text(f'ALTER TABLE "{t}" DISABLE ROW LEVEL SECURITY'))
