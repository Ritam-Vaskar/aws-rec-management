from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.auth import require_session, verify_login_password
from app.services.credentials_store import create_session_token


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


@router.post("/login")
def login(request: LoginRequest) -> dict[str, object]:
    if not verify_login_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid password")

    return {"status": "ok", "token": create_session_token("admin"), "user": "admin"}


@router.get("/session")
def session(request: Request) -> dict[str, object]:
    payload = require_session(request)
    return {"authenticated": True, "user": str(payload.get("sub", "admin"))}


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"status": "ok"}
