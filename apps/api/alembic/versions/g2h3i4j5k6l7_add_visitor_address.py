"""add visitor_address to web_conversations

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'g2h3i4j5k6l7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'web_conversations',
        sa.Column('visitor_address', sa.String(512), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('web_conversations', 'visitor_address')
