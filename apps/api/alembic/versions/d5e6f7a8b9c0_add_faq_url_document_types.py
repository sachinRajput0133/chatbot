"""add faq and url to document type enum

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-11
"""
from alembic import op

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires ADD VALUE outside of a transaction for enum types
    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'faq'")
    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'url'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # To roll back, recreate the enum without the new values (complex — skip for now).
    pass
