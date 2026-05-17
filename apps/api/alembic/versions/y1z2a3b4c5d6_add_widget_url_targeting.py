"""Add widget URL targeting

Revision ID: y1z2a3b4c5d6
Revises: x9y8z7w6v5u4
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'y1z2a3b4c5d6'
down_revision = 'x9y8z7w6v5u4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'widget_configs',
        sa.Column('url_targeting_mode', sa.String(length=16), server_default="all", nullable=False),
    )
    op.add_column(
        'widget_configs',
        sa.Column(
            'url_targeting_patterns',
            postgresql.ARRAY(sa.Text()),
            server_default='{}',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('widget_configs', 'url_targeting_patterns')
    op.drop_column('widget_configs', 'url_targeting_mode')
