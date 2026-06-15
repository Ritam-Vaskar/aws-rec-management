from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.operations import perform_action


router = APIRouter(prefix="/operations", tags=["operations"])


class ActionRequest(BaseModel):
    resource_id: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    action: str = Field(min_length=1)
    account_id: str | None = None
    region: str | None = None


@router.post("/action")
def run_action(request: ActionRequest) -> dict[str, object]:
    try:
        result = perform_action(
            resource_id=request.resource_id,
            resource_type=request.resource_type,
            action=request.action,
            account_id=request.account_id,
            region=request.region,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return result
