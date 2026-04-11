"""add human takeover: mode column and agent message role

Revision ID: f1a2b3c4d5e6
Revises: e6f7a8b9c0d1
Create Date: 2026-04-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e6f7a8b9c0d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'agent' to the messagerole enum type.
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
    # so we use COMMIT + raw DDL.
    op.execute("COMMIT")
    op.execute("ALTER TYPE messagerole ADD VALUE IF NOT EXISTS 'agent'")

    # Add mode column to web_conversations (default 'ai')
    op.add_column(
        'web_conversations',
        sa.Column('mode', sa.String(10), nullable=False, server_default='ai')
    )


def downgrade() -> None:
    op.drop_column('web_conversations', 'mode')
    # Note: PostgreSQL does not support removing enum values.
    # The 'agent' value in the enum is left in place on downgrade.
