"""add conversation ratings (CSAT)

Revision ID: q3r4s5t6u7v8
Revises: s5t6u7v8w9x0
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'q3r4s5t6u7v8'
down_revision = 's5t6u7v8w9x0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversation_ratings',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['conversation_id'], ['web_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('conversation_id', name='uq_conversation_ratings_conversation_id'),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='ck_conversation_ratings_rating_range'),
    )
    op.create_index('ix_conversation_ratings_tenant_id', 'conversation_ratings', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_conversation_ratings_tenant_id', table_name='conversation_ratings')
    op.drop_table('conversation_ratings')
