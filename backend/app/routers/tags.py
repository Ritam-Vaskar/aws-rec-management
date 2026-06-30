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
    remove_tag_keys: list[str] = Field(default_factory=list)
    account_id: str | None = None


class BulkTagResource(BaseModel):
    resource_id: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    account_id: str | None = None
    tags: dict[str, str] = Field(default_factory=dict)


class BulkTagRequest(BaseModel):
    resources: list[BulkTagResource] = Field(min_length=1, max_length=500)
    tags: dict[str, str] = Field(default_factory=dict)
    remove_tag_keys: list[str] = Field(default_factory=list)


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
        remove_tag_keys=request.remove_tag_keys,
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


@router.post("/bulk")
def bulk_update_tags(
    request: BulkTagRequest,
    user: CurrentUser = Depends(require_permission("tags:update")),
) -> dict[str, object]:
    results: list[dict[str, object]] = []
    success_count = 0
    failure_count = 0

    for target in request.resources:
        result: dict[str, object] = {
            "resource_id": target.resource_id,
            "resource_type": target.resource_type,
            "account_id": target.account_id,
        }

        if not user.can_access_account(target.account_id):
            failure_count += 1
            result.update({"status": "denied", "detail": "Account is outside the user's allowed scope"})
            log_audit_event(
                "tags.bulk.denied",
                user,
                resource_id=target.resource_id,
                resource_type=target.resource_type,
                account_id=target.account_id,
            )
            results.append(result)
            continue

        final_tags = dict(target.tags)
        for key in request.remove_tag_keys:
            final_tags.pop(key, None)
        final_tags.update(request.tags)

        try:
            resource = update_resource_tags(
                resource_id=target.resource_id,
                resource_type=target.resource_type,
                tags=final_tags,
                remove_tag_keys=request.remove_tag_keys,
                account_id=target.account_id,
                tenant_id=user.cache_scope(),
                allowed_account_ids=user.allowed_account_ids,
            )
        except KeyError as exc:
            failure_count += 1
            result.update({"status": "failed", "detail": str(exc)})
        except PermissionError as exc:
            failure_count += 1
            result.update({"status": "denied", "detail": str(exc)})
        except RuntimeError as exc:
            failure_count += 1
            result.update({"status": "failed", "detail": str(exc)})
        else:
            success_count += 1
            result.update({"status": "ok", "resource": resource, "tags": final_tags})

        results.append(result)

    log_audit_event(
        "tags.bulk",
        user,
        requested=len(request.resources),
        succeeded=success_count,
        failed=failure_count,
        tag_keys=sorted(request.tags),
        remove_tag_keys=sorted(request.remove_tag_keys),
    )
    return {
        "status": "ok" if failure_count == 0 else "partial",
        "requested": len(request.resources),
        "succeeded": success_count,
        "failed": failure_count,
        "results": results,
    }
