from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from app.core import permissions as perms_registry


class RolePermissionEntry(BaseModel):
    module: str
    action: str

    @field_validator("module")
    @classmethod
    def _validate_module(cls, v: str) -> str:
        if v not in perms_registry.MODULES:
            raise ValueError(f"Unknown module: {v}")
        return v

    @field_validator("action")
    @classmethod
    def _validate_action(cls, v: str, info) -> str:
        module = info.data.get("module")
        if module and v not in perms_registry.MODULES.get(module, frozenset()):
            raise ValueError(f"Action '{v}' not allowed for module '{module}'")
        return v


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    permissions: list[RolePermissionEntry] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    permissions: list[RolePermissionEntry] | None = None


class RoleOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_system: bool = False
    permissions: list[RolePermissionEntry] = Field(default_factory=list)
    user_count: int = 0
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class PermissionRegistryOut(BaseModel):
    modules: dict[str, list[str]]
