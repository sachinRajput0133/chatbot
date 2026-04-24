"""add primary_notification_email to tenants

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'k6l7m8n9o0p1'
down_revision = 'j5k6l7m8n9o0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('primary_notification_email', sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'primary_notification_email')
