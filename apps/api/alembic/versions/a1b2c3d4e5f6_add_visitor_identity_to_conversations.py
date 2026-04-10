"""add visitor identity to conversations

Revision ID: a1b2c3d4e5f6
Revises: 4f798f3a959e
Create Date: 2026-04-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '4f798f3a959e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('web_conversations', sa.Column('visitor_name', sa.String(256), nullable=True))
    op.add_column('web_conversations', sa.Column('visitor_email', sa.String(256), nullable=True))
    op.add_column('web_conversations', sa.Column('visitor_phone', sa.String(64), nullable=True))
    op.add_column('web_conversations', sa.Column('external_user_id', sa.String(256), nullable=True))


def downgrade() -> None:
    op.drop_column('web_conversations', 'external_user_id')
    op.drop_column('web_conversations', 'visitor_phone')
    op.drop_column('web_conversations', 'visitor_email')
    op.drop_column('web_conversations', 'visitor_name')
