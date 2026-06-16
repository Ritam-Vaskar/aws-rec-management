from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.dependencies import require_permission
from app.auth.models import CurrentUser
from app.services.audit import log_audit_event
from app.services.inventory import update_resource_tags


router = APIRouter(prefix="/tags", tags=["tags"])


class TagUpdateRequest(BaseModel):
    resource_id: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    tags: dict[str, str] = Field(default_factory=dict)
    account_id: str | None = None


@router.post("/update")
def update_tags(
    request: TagUpdateRequest,
    user: CurrentUser = Depends(require_permission("tags:update")),
) -> dict[str, object]:
    if not user.can_access_account(request.account_id):
        log_audit_event(
            "tags.update.denied",
            user,
            resource_id=request.resource_id,
            resource_type=request.resource_type,
            account_id=request.account_id,
        )
        raise HTTPException(status_code=403, detail="Account is outside the user's allowed scope")

    try:
        resource = update_resource_tags(
            resource_id=request.resource_id,
            resource_type=request.resource_type,
            tags=request.tags,
            account_id=request.account_id,
            tenant_id=user.cache_scope(),
            allowed_account_ids=user.allowed_account_ids,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    log_audit_event(
        "tags.update",
        user,
        resource_id=request.resource_id,
        resource_type=request.resource_type,
        account_id=request.account_id,
        tag_keys=sorted(request.tags),
    )
    return {"status": "ok", "resource": resource}
