"""add lead_capture_configs table

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e6f7a8b9c0d1'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'lead_capture_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('collect_name', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('collect_email', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('collect_phone', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('collect_address', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('custom_questions', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('skip_if_filled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('trigger_after', sa.Integer(), nullable=False, server_default='1'),
    )


def downgrade() -> None:
    op.drop_table('lead_capture_configs')
