from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.services.auth import require_session
from app.services.credentials_store import masked_aws_settings, merged_aws_settings, save_aws_settings


router = APIRouter(prefix="/settings", tags=["settings"])


class AwsSettingsRequest(BaseModel):
    AWS_ACCESS_KEY_ID: str = Field(default="")
    AWS_SECRET_ACCESS_KEY: str = Field(default="")
    AWS_SESSION_TOKEN: str = Field(default="")
    AWS_DEFAULT_REGION: str = Field(default="")
    AWS_ASSUME_ROLE_ARN: str = Field(default="")
    AWS_ASSUME_ROLE_SESSION_NAME: str = Field(default="")


@router.get("/aws")
def get_aws_settings(_: dict[str, object] = Depends(require_session)) -> dict[str, object]:
    current = merged_aws_settings()
    return {"status": "ok", "settings": masked_aws_settings(current)}


@router.post("/aws")
def update_aws_settings(request: AwsSettingsRequest, _: dict[str, object] = Depends(require_session)) -> dict[str, object]:
    current = merged_aws_settings(overrides=request.model_dump())
    save_aws_settings(current)
    return {"status": "ok", "settings": masked_aws_settings(current)}
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.auth import require_session
from app.services.secure_store import load_aws_credentials, masked_aws_credentials, save_aws_credentials


router = APIRouter(prefix="/settings", tags=["settings"])


class AwsSettingsUpdate(BaseModel):
    AWS_ACCESS_KEY_ID: str = Field(default="")
    AWS_SECRET_ACCESS_KEY: str = Field(default="")
    AWS_SESSION_TOKEN: str = Field(default="")
    AWS_DEFAULT_REGION: str = Field(default="")
    AWS_ASSUME_ROLE_ARN: str = Field(default="")
    AWS_ASSUME_ROLE_SESSION_NAME: str = Field(default="")


@router.get("/aws")
def get_aws_settings(user: str = Depends(require_session)) -> dict[str, object]:
    settings = load_aws_credentials()
    return {
        "authenticated": True,
        "user": user,
        "settings": masked_aws_credentials(settings),
    }


@router.post("/aws")
def update_aws_settings(request: AwsSettingsUpdate, user: str = Depends(require_session)) -> dict[str, object]:
    existing = load_aws_credentials()
    updated = {
        "AWS_ACCESS_KEY_ID": request.AWS_ACCESS_KEY_ID or existing.get("AWS_ACCESS_KEY_ID", ""),
        "AWS_SECRET_ACCESS_KEY": request.AWS_SECRET_ACCESS_KEY or existing.get("AWS_SECRET_ACCESS_KEY", ""),
        "AWS_SESSION_TOKEN": request.AWS_SESSION_TOKEN or existing.get("AWS_SESSION_TOKEN", ""),
        "AWS_DEFAULT_REGION": request.AWS_DEFAULT_REGION or existing.get("AWS_DEFAULT_REGION", "us-east-1"),
        "AWS_ASSUME_ROLE_ARN": request.AWS_ASSUME_ROLE_ARN or existing.get("AWS_ASSUME_ROLE_ARN", ""),
        "AWS_ASSUME_ROLE_SESSION_NAME": request.AWS_ASSUME_ROLE_SESSION_NAME
        or existing.get("AWS_ASSUME_ROLE_SESSION_NAME", "aws-dash-dashboard"),
    }
    save_aws_credentials(updated)
    return {"status": "ok", "user": user, "settings": masked_aws_credentials(updated)}
