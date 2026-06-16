from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.config import AuthSettings, get_auth_settings
from app.auth.jwt import values_from_claim, verify_token
from app.auth.models import CurrentUser
from app.auth.policy import has_permission


bearer = HTTPBearer(auto_error=False)


def _roles_from_claims(claim_roles: set[str], groups: set[str], settings: AuthSettings) -> set[str]:
    roles = set(claim_roles)
    if groups & settings.viewer_groups:
        roles.add("viewer")
    if groups & settings.tag_editor_groups:
        roles.add("tag_editor")
    if groups & settings.admin_groups:
        roles.add("admin")
    return roles


def _tenant_from_claims(claims: dict[str, object], settings: AuthSettings) -> str:
    tenant = claims.get(settings.tenant_claim)
    if isinstance(tenant, str) and tenant.strip():
        return tenant.strip()
    if settings.allow_default_tenant:
        return settings.default_tenant
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not mapped to a tenant")


def _accounts_from_claims(claims: dict[str, object], tenant_id: str, settings: AuthSettings) -> frozenset[str] | None:
    claim_accounts = values_from_claim(claims, settings.accounts_claim)
    tenant_accounts = set(settings.tenant_accounts.get(tenant_id, []))
    if "*" in claim_accounts:
        return frozenset(tenant_accounts) if tenant_accounts else None
    if claim_accounts and tenant_accounts:
        return frozenset(claim_accounts & tenant_accounts)
    if claim_accounts:
        return frozenset(claim_accounts)
    if tenant_accounts:
        return frozenset(tenant_accounts)
    return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: AuthSettings = Depends(get_auth_settings),
) -> CurrentUser:
    if not settings.enabled:
        return CurrentUser(
            subject="local-dev",
            email="local-dev@example.com",
            name="Local Dev",
            tenant_id=settings.default_tenant,
            roles=frozenset({"admin"}),
            groups=frozenset(),
            allowed_account_ids=None,
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    claims = verify_token(credentials.credentials, settings)
    groups = values_from_claim(claims, settings.groups_claim)
    claim_roles = values_from_claim(claims, settings.roles_claim)
    roles = _roles_from_claims(claim_roles, groups, settings)
    if not roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no dashboard role")

    tenant_id = _tenant_from_claims(claims, settings)
    return CurrentUser(
        subject=str(claims.get("sub", "")),
        email=str(claims.get("email", "")),
        name=str(claims.get("name", claims.get("preferred_username", ""))),
        tenant_id=tenant_id,
        roles=frozenset(roles),
        groups=frozenset(groups),
        allowed_account_ids=_accounts_from_claims(claims, tenant_id, settings),
    )


def require_permission(permission: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not has_permission(user, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency
