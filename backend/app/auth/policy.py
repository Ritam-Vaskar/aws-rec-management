from __future__ import annotations

from app.auth.models import CurrentUser


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {"resources:read"},
    "tag_editor": {"resources:read", "resources:refresh", "tags:update"},
    "admin": {"resources:read", "resources:refresh", "tags:update", "admin:manage"},
}


def has_permission(user: CurrentUser, permission: str) -> bool:
    if user.is_admin:
        return True
    return any(permission in ROLE_PERMISSIONS.get(role, set()) for role in user.roles)
