"""add dodo to payment_gateway enum

Revision ID: n9o0p1q2r3s4
Revises: m8n9o0p1q2r3
Create Date: 2026-04-25 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'n9o0p1q2r3s4'
down_revision = 'm8n9o0p1q2r3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE to add a value to an enum
    op.execute("ALTER TYPE paymentgateway ADD VALUE IF NOT EXISTS 'dodo'")


def downgrade() -> None:
    # PostgreSQL cannot remove enum values without recreating the type.
    # We leave the value in place during downgrade — it simply won't be used.
    pass
