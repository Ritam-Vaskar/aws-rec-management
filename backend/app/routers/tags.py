from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.inventory import update_resource_tags


router = APIRouter(prefix="/tags", tags=["tags"])


class TagUpdateRequest(BaseModel):
    resource_id: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    tags: dict[str, str] = Field(default_factory=dict)
    account_id: str | None = None
    tenant_id: str = "default"


@router.post("/update")
def update_tags(request: TagUpdateRequest) -> dict[str, object]:
    try:
        resource = update_resource_tags(
            resource_id=request.resource_id,
            resource_type=request.resource_type,
            tags=request.tags,
            account_id=request.account_id,
            tenant_id=request.tenant_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"status": "ok", "resource": resource}
