"""add is_internal column to web_messages

Revision ID: s5t6u7v8w9x0
Revises: q2r3s4t5u6v7
Create Date: 2026-05-17 00:00:00.000000

Adds an `is_internal` boolean column to `web_messages` to support
agent-only internal notes that are never shown to visitors.
"""
from alembic import op
import sqlalchemy as sa


revision = 's5t6u7v8w9x0'
down_revision = 'q2r3s4t5u6v7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "web_messages",
        sa.Column(
            "is_internal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("web_messages", "is_internal")
