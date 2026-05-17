"""add hubspot_access_token to tenants

Revision ID: w9x0y1z2a3b4
Revises: t6u7v8w9x0y1
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'w9x0y1z2a3b4'
down_revision = 'v8w9x0y1z2a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('hubspot_access_token', sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'hubspot_access_token')
