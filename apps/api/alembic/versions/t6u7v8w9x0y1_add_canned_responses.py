"""add canned_responses table

Revision ID: t6u7v8w9x0y1
Revises: y1z2a3b4c5d6
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 't6u7v8w9x0y1'
down_revision = 'y1z2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'canned_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('shortcut', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'shortcut', name='uq_canned_responses_tenant_shortcut'),
    )
    op.create_index('ix_canned_responses_tenant_id', 'canned_responses', ['tenant_id'])
    op.create_index('ix_canned_responses_shortcut', 'canned_responses', ['shortcut'])


def downgrade() -> None:
    op.drop_index('ix_canned_responses_shortcut', table_name='canned_responses')
    op.drop_index('ix_canned_responses_tenant_id', table_name='canned_responses')
    op.drop_table('canned_responses')
