from __future__ import annotations

import secrets

from fastapi import HTTPException, Request, status

from app.services.credentials_store import verify_session_token


SESSION_COOKIE_NAME = "aws_dash_session"


def _configured_password() -> str:
    import os

    return os.getenv("DASHBOARD_AUTH_PASSWORD", "admin")


def verify_login_password(password: str) -> bool:
    return secrets.compare_digest(password, _configured_password())


def require_session(request: Request) -> dict[str, object]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")

    return payload
