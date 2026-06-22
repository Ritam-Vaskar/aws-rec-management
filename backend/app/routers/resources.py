from fastapi import APIRouter, Query, BackgroundTasks, Depends, HTTPException

from app.auth.dependencies import require_permission
from app.auth.models import CurrentUser
from app.auth.policy import has_permission
from app.services.inventory import list_resources, collect_live_resources
from app.services.cache import get_cached_resources
from app.services.audit import log_audit_event


router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("")
def get_resources(
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_permission("resources:read")),
    search: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    region: str | None = Query(default=None),
    tag_key: str | None = Query(default=None),
    tag_value: str | None = Query(default=None),
    untagged_only: bool = Query(default=False),
    force_refresh: bool = Query(default=False),
) -> list[dict[str, object]]:
    cache_scope = user.cache_scope()
    
    if force_refresh:
        if not has_permission(user, "resources:refresh"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if get_cached_resources(cache_scope) is not None:
            background_tasks.add_task(collect_live_resources, cache_scope, user.allowed_account_ids)
            force_refresh = False
        log_audit_event("resources.refresh", user, cache_scope=cache_scope, background=not force_refresh)

    return list_resources(
        search=search,
        resource_type=resource_type,
        region=region,
        tag_key=tag_key,
        tag_value=tag_value,
        untagged_only=untagged_only,
        tenant_id=cache_scope,
        allowed_account_ids=user.allowed_account_ids,
        force_refresh=force_refresh,
    )
