"""add alert_keywords to tenants

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-04-25 00:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "l7m8n9o0p1q2"
down_revision = "k6l7m8n9o0p1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tenants", sa.Column("alert_keywords", JSONB, nullable=True))


def downgrade():
    op.drop_column("tenants", "alert_keywords")
