from fastapi import APIRouter, Depends, Query

from app.services.auth import require_session
from app.services.inventory import list_resources


router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("")
def get_resources(
    user: str = Depends(require_session),
    search: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    region: str | None = Query(default=None),
    tag_key: str | None = Query(default=None),
    tag_value: str | None = Query(default=None),
    untagged_only: bool = Query(default=False),
) -> list[dict[str, object]]:
    return list_resources(
        search=search,
        resource_type=resource_type,
        region=region,
        tag_key=tag_key,
        tag_value=tag_value,
        untagged_only=untagged_only,
    )
