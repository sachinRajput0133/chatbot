"""add salesforce integration columns to tenants

Revision ID: x0y1z2a3b4c5
Revises: t6u7v8w9x0y1
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'x0y1z2a3b4c5'
down_revision = 'w9x0y1z2a3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('salesforce_client_id', sa.String(length=1024), nullable=True))
    op.add_column('tenants', sa.Column('salesforce_client_secret', sa.String(length=1024), nullable=True))
    op.add_column('tenants', sa.Column('salesforce_username', sa.String(length=1024), nullable=True))
    op.add_column('tenants', sa.Column('salesforce_password', sa.String(length=1024), nullable=True))
    op.add_column('tenants', sa.Column('salesforce_instance_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'salesforce_instance_url')
    op.drop_column('tenants', 'salesforce_password')
    op.drop_column('tenants', 'salesforce_username')
    op.drop_column('tenants', 'salesforce_client_secret')
    op.drop_column('tenants', 'salesforce_client_id')
