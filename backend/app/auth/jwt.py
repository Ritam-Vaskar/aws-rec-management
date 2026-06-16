from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException, status

from app.auth.config import AuthSettings


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value]
    return []


def _decode_test_token(token: str) -> dict[str, Any]:
    try:
        padded = token + ("=" * (-len(token) % 4))
        return json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid test token") from exc


def verify_token(token: str, settings: AuthSettings) -> dict[str, Any]:
    if settings.test_mode:
        return _decode_test_token(token)

    if not settings.issuer or not settings.audience or not settings.jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC issuer, audience, and JWKS URL must be configured",
        )

    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PyJWT with crypto support is required for OIDC verification",
        ) from exc

    try:
        signing_key = PyJWKClient(settings.jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
            audience=settings.audience,
            issuer=settings.issuer,
            options={"require": ["exp", "iat", "iss", "sub"]},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc


def values_from_claim(claims: dict[str, Any], claim_name: str) -> set[str]:
    return set(_as_list(claims.get(claim_name)))
