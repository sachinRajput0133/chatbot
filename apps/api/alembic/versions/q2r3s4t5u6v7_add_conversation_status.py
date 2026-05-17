"""add conversation status lifecycle

Revision ID: q2r3s4t5u6v7
Revises: ccac4f4b5697
Create Date: 2026-05-17 00:00:00.000000

Adds status, resolved_at, resolved_by_user_id to web_conversations to support
the open/pending/resolved/closed lifecycle for agent inbox triage.
"""
from alembic import op
import sqlalchemy as sa


revision = 'q2r3s4t5u6v7'
down_revision = 'ccac4f4b5697'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'web_conversations',
        sa.Column('status', sa.String(length=16), nullable=False, server_default='open'),
    )
    op.add_column(
        'web_conversations',
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'web_conversations',
        sa.Column('resolved_by_user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_web_conversations_resolved_by_user_id',
        'web_conversations',
        'users',
        ['resolved_by_user_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_check_constraint(
        'ck_web_conversations_status',
        'web_conversations',
        "status IN ('open','pending','resolved','closed')",
    )
    # Backfill existing rows to "open" (server_default already covers, but be explicit)
    op.execute("UPDATE web_conversations SET status = 'open' WHERE status IS NULL")


def downgrade() -> None:
    op.drop_constraint('ck_web_conversations_status', 'web_conversations', type_='check')
    op.drop_constraint('fk_web_conversations_resolved_by_user_id', 'web_conversations', type_='foreignkey')
    op.drop_column('web_conversations', 'resolved_by_user_id')
    op.drop_column('web_conversations', 'resolved_at')
    op.drop_column('web_conversations', 'status')
