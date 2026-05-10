"""
Permission registry — single source of truth for all RBAC modules and actions.

Adding a new feature module:
1. Add the module name + supported actions here.
2. Wrap the relevant routes with `require_permission(module, action)`.

The frontend fetches this registry from /api/roles/permissions/registry to
render the role-edit checkbox grid dynamically.
"""

# (module_key, set of allowed actions for that module)
MODULES: dict[str, frozenset[str]] = {
    "knowledge":     frozenset({"view", "create", "edit", "delete"}),
    "customize":     frozenset({"view", "manage"}),
    "lead_capture":  frozenset({"view", "manage"}),
    "goals":         frozenset({"view", "create", "edit", "delete"}),
    "embed":         frozenset({"view"}),
    "developer":     frozenset({"view", "manage"}),       # API keys
    "conversations": frozenset({"view", "edit", "delete"}),
    "analytics":     frozenset({"view"}),
    "integrations":  frozenset({"view", "manage"}),
    "billing":       frozenset({"view", "manage"}),
    "users":         frozenset({"view", "create", "edit", "delete"}),
    "roles":         frozenset({"view", "create", "edit", "delete"}),
}

ALL_ACTIONS: frozenset[str] = frozenset({"view", "create", "edit", "delete", "manage"})


def is_valid(module: str, action: str) -> bool:
    return module in MODULES and action in MODULES[module]


def all_pairs() -> list[tuple[str, str]]:
    """Every (module, action) pair across all modules — used to seed the Owner role."""
    return [(m, a) for m, actions in MODULES.items() for a in actions]


def registry_dict() -> dict[str, list[str]]:
    """Serializable form for the API response."""
    return {m: sorted(actions) for m, actions in MODULES.items()}
