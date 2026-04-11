"""add brand voice fields to widget_configs

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('widget_configs', sa.Column('company_website', sa.String(512), nullable=True))
    op.add_column('widget_configs', sa.Column('company_email', sa.String(256), nullable=True))
    op.add_column('widget_configs', sa.Column('company_address', sa.Text(), nullable=True))
    op.add_column('widget_configs', sa.Column('company_phone', sa.String(64), nullable=True))
    op.add_column('widget_configs', sa.Column('business_hours', sa.String(512), nullable=True))
    op.add_column('widget_configs', sa.Column('tone_of_voice', sa.String(128), nullable=True))
    op.add_column('widget_configs', sa.Column('target_audience', sa.Text(), nullable=True))
    op.add_column('widget_configs', sa.Column('brand_values', sa.Text(), nullable=True))
    op.add_column('widget_configs', sa.Column('what_we_do', sa.Text(), nullable=True))
    op.add_column('widget_configs', sa.Column('unique_selling_proposition', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('widget_configs', 'unique_selling_proposition')
    op.drop_column('widget_configs', 'what_we_do')
    op.drop_column('widget_configs', 'brand_values')
    op.drop_column('widget_configs', 'target_audience')
    op.drop_column('widget_configs', 'tone_of_voice')
    op.drop_column('widget_configs', 'business_hours')
    op.drop_column('widget_configs', 'company_phone')
    op.drop_column('widget_configs', 'company_address')
    op.drop_column('widget_configs', 'company_email')
    op.drop_column('widget_configs', 'company_website')
