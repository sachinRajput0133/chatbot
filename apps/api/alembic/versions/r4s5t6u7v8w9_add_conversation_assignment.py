"""add conversation assignment fields

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-05-17 12:00:00.000000

Adds `assigned_user_id` (FK to users.id) and `assigned_at` to web_conversations
to support per-conversation agent assignment ("My inbox" filter).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'r4s5t6u7v8w9'
down_revision = 'q3r4s5t6u7v8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'web_conversations',
        sa.Column('assigned_user_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'web_conversations',
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_web_conversations_assigned_user_id_users',
        'web_conversations',
        'users',
        ['assigned_user_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_web_conversations_assigned_user_id',
        'web_conversations',
        ['assigned_user_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_web_conversations_assigned_user_id', table_name='web_conversations')
    op.drop_constraint(
        'fk_web_conversations_assigned_user_id_users',
        'web_conversations',
        type_='foreignkey',
    )
    op.drop_column('web_conversations', 'assigned_at')
    op.drop_column('web_conversations', 'assigned_user_id')
