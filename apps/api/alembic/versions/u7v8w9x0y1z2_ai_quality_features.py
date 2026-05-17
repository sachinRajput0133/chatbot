"""add citations, feedback to web_messages and confidence handoff to widget_configs

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-05-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "u7v8w9x0y1z2"
down_revision = "t6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # B1 — citations on web_messages
    op.add_column(
        "web_messages",
        sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    # B2 — feedback on web_messages
    op.add_column(
        "web_messages",
        sa.Column("feedback_rating", sa.Integer(), nullable=True),
    )
    op.add_column(
        "web_messages",
        sa.Column("feedback_comment", sa.Text(), nullable=True),
    )
    # B3 — confidence-based handoff on widget_configs
    op.add_column(
        "widget_configs",
        sa.Column(
            "confidence_threshold",
            sa.Float(),
            nullable=False,
            server_default="0.5",
        ),
    )
    op.add_column(
        "widget_configs",
        sa.Column(
            "auto_handoff_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("widget_configs", "auto_handoff_enabled")
    op.drop_column("widget_configs", "confidence_threshold")
    op.drop_column("web_messages", "feedback_comment")
    op.drop_column("web_messages", "feedback_rating")
    op.drop_column("web_messages", "citations")
