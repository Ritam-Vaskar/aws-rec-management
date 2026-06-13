from fastapi import APIRouter, Query, BackgroundTasks

from app.services.inventory import list_resources, collect_live_resources
from app.services.cache import get_cached_resources


router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("")
def get_resources(
    background_tasks: BackgroundTasks,
    search: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    region: str | None = Query(default=None),
    tag_key: str | None = Query(default=None),
    tag_value: str | None = Query(default=None),
    untagged_only: bool = Query(default=False),
    tenant_id: str = Query(default="default"),
    force_refresh: bool = Query(default=False),
) -> list[dict[str, object]]:
    
    if force_refresh:
        if get_cached_resources(tenant_id) is not None:
            background_tasks.add_task(collect_live_resources, tenant_id)
            force_refresh = False

    return list_resources(
        search=search,
        resource_type=resource_type,
        region=region,
        tag_key=tag_key,
        tag_value=tag_value,
        untagged_only=untagged_only,
        tenant_id=tenant_id,
        force_refresh=force_refresh,
    )
