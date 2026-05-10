"""add rbac roles and users invitation

Revision ID: p1q2r3s4t5u6
Revises: 347fa6a928fc
Create Date: 2026-04-26 12:00:00.000000

Schema changes for role-based access control + user invitation flow:
- New `roles` table (per-tenant custom roles)
- New `role_permissions` table (module + action grants)
- `users.role_id`, `users.must_change_password`, `users.is_active`,
  `users.invited_by_user_id`
- New `member` value on userrole enum
- Backfill: seed an "Owner" system role for every existing tenant.

Existing users keep `role=owner` and `role_id=NULL` — owners bypass permission
checks at runtime, so no behavior change for current data.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'p1q2r3s4t5u6'
down_revision = '347fa6a928fc'
branch_labels = None
depends_on = None


# Permission registry — mirrors app/core/permissions.py at the time the
# migration was written. Used only for the data backfill below; the runtime
# registry stays the source of truth for new roles.
_REGISTRY = {
    "knowledge":     ["view", "create", "edit", "delete"],
    "customize":     ["view", "manage"],
    "lead_capture":  ["view", "manage"],
    "goals":         ["view", "create", "edit", "delete"],
    "embed":         ["view"],
    "developer":     ["view", "manage"],
    "conversations": ["view", "edit", "delete"],
    "analytics":     ["view"],
    "integrations":  ["view", "manage"],
    "billing":       ["view", "manage"],
    "users":         ["view", "create", "edit", "delete"],
    "roles":         ["view", "create", "edit", "delete"],
}


def upgrade() -> None:
    # Add `member` value to the existing userrole enum.
    # Postgres requires this outside a transaction in older versions, but
    # ADD VALUE IF NOT EXISTS is idempotent and works inside autocommit blocks
    # used by Alembic in modern PG.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'member'")

    # ── roles ─────────────────────────────────────────────────────────────────
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_roles_tenant_name'),
    )
    op.create_index('ix_roles_tenant_id', 'roles', ['tenant_id'])

    # ── role_permissions ──────────────────────────────────────────────────────
    op.create_table(
        'role_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('module', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'module', 'action', name='uq_role_permissions_role_module_action'),
    )
    op.create_index('ix_role_permissions_role_id', 'role_permissions', ['role_id'])

    # ── users new columns ────────────────────────────────────────────────────
    op.add_column('users', sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('users', sa.Column(
        'must_change_password', sa.Boolean(), nullable=False, server_default=sa.false()
    ))
    op.add_column('users', sa.Column(
        'is_active', sa.Boolean(), nullable=False, server_default=sa.true()
    ))
    op.add_column('users', sa.Column('invited_by_user_id', postgresql.UUID(as_uuid=True), nullable=True))

    op.create_foreign_key(
        'fk_users_role_id_roles', 'users', 'roles', ['role_id'], ['id'], ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_users_invited_by_user_id_users', 'users', 'users', ['invited_by_user_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_users_role_id', 'users', ['role_id'])

    # Drop server defaults so SQLAlchemy controls them going forward
    op.alter_column('users', 'must_change_password', server_default=None)
    op.alter_column('users', 'is_active', server_default=None)
    op.alter_column('roles', 'is_system', server_default=None)

    # ── Data backfill: seed Owner role for every existing tenant ─────────────
    bind = op.get_bind()
    tenants = bind.execute(sa.text("SELECT id FROM tenants")).fetchall()
    for (tenant_id,) in tenants:
        result = bind.execute(
            sa.text(
                "INSERT INTO roles (id, tenant_id, name, description, is_system, created_at) "
                "VALUES (gen_random_uuid(), :tid, 'Owner', "
                "'Full access to all modules. Cannot be edited or deleted.', true, now()) "
                "RETURNING id"
            ),
            {"tid": tenant_id},
        )
        owner_role_id = result.scalar()
        # Insert all permissions for owner
        for module, actions in _REGISTRY.items():
            for action in actions:
                bind.execute(
                    sa.text(
                        "INSERT INTO role_permissions (id, role_id, module, action) "
                        "VALUES (gen_random_uuid(), :rid, :m, :a)"
                    ),
                    {"rid": owner_role_id, "m": module, "a": action},
                )


def downgrade() -> None:
    op.drop_index('ix_users_role_id', table_name='users')
    op.drop_constraint('fk_users_invited_by_user_id_users', 'users', type_='foreignkey')
    op.drop_constraint('fk_users_role_id_roles', 'users', type_='foreignkey')
    op.drop_column('users', 'invited_by_user_id')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'must_change_password')
    op.drop_column('users', 'role_id')

    op.drop_index('ix_role_permissions_role_id', table_name='role_permissions')
    op.drop_table('role_permissions')

    op.drop_index('ix_roles_tenant_id', table_name='roles')
    op.drop_table('roles')
    # Note: the 'member' enum value is intentionally NOT dropped — Postgres
    # cannot remove enum values cleanly, and downgrading is destructive enough
    # already.
