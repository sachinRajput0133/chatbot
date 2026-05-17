"""add enforce_business_hours to widget_configs

Revision ID: v8w9x0y1z2a3
Revises: t6u7v8w9x0y1
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'v8w9x0y1z2a3'
down_revision = 'u7v8w9x0y1z2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'widget_configs',
        sa.Column('enforce_business_hours', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('widget_configs', 'enforce_business_hours')
