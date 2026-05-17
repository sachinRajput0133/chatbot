"""add lead_score and lead_score_factors to web_conversations

Revision ID: z3a4b5c6d7e8
Revises: t6u7v8w9x0y1
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'z3a4b5c6d7e8'
down_revision = 'x0y1z2a3b4c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'web_conversations',
        sa.Column('lead_score', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'web_conversations',
        sa.Column('lead_score_factors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index(
        'ix_web_conversations_lead_score',
        'web_conversations',
        ['lead_score'],
    )


def downgrade() -> None:
    op.drop_index('ix_web_conversations_lead_score', table_name='web_conversations')
    op.drop_column('web_conversations', 'lead_score_factors')
    op.drop_column('web_conversations', 'lead_score')
