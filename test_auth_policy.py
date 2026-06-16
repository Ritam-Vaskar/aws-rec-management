#!/usr/bin/env python3
import base64
import json
import os
import sys
from pathlib import Path

from fastapi.security import HTTPAuthorizationCredentials

sys.path.insert(0, str(Path(__file__).parent / "backend"))


def test_token(claims: dict[str, object]) -> str:
    raw = json.dumps(claims).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def main() -> None:
    os.environ["AUTH_ENABLED"] = "true"
    os.environ["AUTH_TEST_MODE"] = "true"
    os.environ["AUTH_ALLOW_DEFAULT_TENANT"] = "false"
    os.environ["AUTH_VIEWER_GROUPS"] = "aws-dash-viewers"
    os.environ["AUTH_TAG_EDITOR_GROUPS"] = "aws-dash-tag-editors"
    os.environ["AUTH_ADMIN_GROUPS"] = "aws-dash-admins"
    os.environ["AUTH_TENANT_ACCOUNTS_JSON"] = '{"finance":["111111111111","222222222222"]}'

    from app.auth.config import get_auth_settings
    from app.auth.dependencies import get_current_user
    from app.auth.policy import has_permission

    get_auth_settings.cache_clear()
    settings = get_auth_settings()
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=test_token(
            {
                "sub": "user-1",
                "email": "user@example.com",
                "groups": ["aws-dash-tag-editors"],
                "aws_dash_tenant": "finance",
                "aws_accounts": ["111111111111", "333333333333"],
            }
        ),
    )

    user = get_current_user(credentials, settings)
    assert user.tenant_id == "finance"
    assert user.roles == frozenset({"tag_editor"})
    assert user.allowed_account_ids == frozenset({"111111111111"})
    assert has_permission(user, "resources:read")
    assert has_permission(user, "tags:update")
    assert user.can_access_account("111111111111")
    assert not user.can_access_account("222222222222")

    viewer_credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=test_token(
            {
                "sub": "user-2",
                "groups": ["aws-dash-viewers"],
                "aws_dash_tenant": "finance",
                "aws_accounts": ["222222222222"],
            }
        ),
    )
    viewer = get_current_user(viewer_credentials, settings)
    assert viewer.roles == frozenset({"viewer"})
    assert has_permission(viewer, "resources:read")
    assert not has_permission(viewer, "tags:update")

    print("Auth policy tests passed")


if __name__ == "__main__":
    main()
