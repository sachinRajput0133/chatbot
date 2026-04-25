"""add whatsapp notification support to tenants

Revision ID: m8n9o0p1q2r3
Revises: l7m8n9o0p1q2
Create Date: 2026-04-25 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "m8n9o0p1q2r3"
down_revision = "l7m8n9o0p1q2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tenants", sa.Column("whatsapp_phone_number_id", sa.String(512), nullable=True))
    op.add_column("tenants", sa.Column("whatsapp_access_token", sa.String(1024), nullable=True))
    op.add_column("tenants", sa.Column("whatsapp_recipient_phones", JSONB, nullable=True))


def downgrade():
    op.drop_column("tenants", "whatsapp_recipient_phones")
    op.drop_column("tenants", "whatsapp_access_token")
    op.drop_column("tenants", "whatsapp_phone_number_id")
