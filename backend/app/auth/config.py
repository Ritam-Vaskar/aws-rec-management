from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from pydantic import BaseModel


def _csv(value: str | None) -> set[str]:
    return {item.strip() for item in (value or "").split(",") if item.strip()}


def _json_object(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object")
    return parsed


class AuthSettings(BaseModel):
    enabled: bool
    issuer: str
    audience: str
    jwks_url: str
    groups_claim: str
    roles_claim: str
    tenant_claim: str
    accounts_claim: str
    viewer_groups: set[str]
    tag_editor_groups: set[str]
    admin_groups: set[str]
    default_tenant: str
    allow_default_tenant: bool
    tenant_accounts: dict[str, list[str]]
    test_mode: bool


@lru_cache
def get_auth_settings() -> AuthSettings:
    issuer = os.getenv("OIDC_ISSUER", "").rstrip("/")
    jwks_url = os.getenv("OIDC_JWKS_URL") or (f"{issuer}/.well-known/jwks.json" if issuer else "")
    return AuthSettings(
        enabled=os.getenv("AUTH_ENABLED", "true").lower() == "true",
        issuer=issuer,
        audience=os.getenv("OIDC_AUDIENCE", ""),
        jwks_url=jwks_url,
        groups_claim=os.getenv("AUTH_GROUPS_CLAIM", "groups"),
        roles_claim=os.getenv("AUTH_ROLES_CLAIM", "roles"),
        tenant_claim=os.getenv("AUTH_TENANT_CLAIM", "aws_dash_tenant"),
        accounts_claim=os.getenv("AUTH_ACCOUNTS_CLAIM", "aws_accounts"),
        viewer_groups=_csv(os.getenv("AUTH_VIEWER_GROUPS")),
        tag_editor_groups=_csv(os.getenv("AUTH_TAG_EDITOR_GROUPS")),
        admin_groups=_csv(os.getenv("AUTH_ADMIN_GROUPS")),
        default_tenant=os.getenv("AUTH_DEFAULT_TENANT", "default"),
        allow_default_tenant=os.getenv("AUTH_ALLOW_DEFAULT_TENANT", "false").lower() == "true",
        tenant_accounts=_json_object(os.getenv("AUTH_TENANT_ACCOUNTS_JSON")),
        test_mode=os.getenv("AUTH_TEST_MODE", "false").lower() == "true",
    )
