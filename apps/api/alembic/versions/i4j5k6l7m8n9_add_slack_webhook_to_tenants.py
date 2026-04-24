"""add slack_webhook_url to tenants

Revision ID: i4j5k6l7m8n9
Revises: f5149e09613e
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'i4j5k6l7m8n9'
down_revision = 'f5149e09613e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('slack_webhook_url', sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'slack_webhook_url')
