from fastapi import APIRouter, Query, Depends

from app.auth.dependencies import require_permission
from app.auth.models import CurrentUser
from app.services.audit import get_recent_audit_events


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/events")
def list_audit_events(
    limit: int = Query(default=100, ge=1, le=1000),
    action: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    _user: CurrentUser = Depends(require_permission("resources:read")),
) -> list[dict]:
    """Return recent audit events, optionally filtered by action or user email."""
    events = get_recent_audit_events(n=limit)

    if action:
        events = [e for e in events if action.lower() in e.get("action", "").lower()]
    if user_email:
        events = [e for e in events if user_email.lower() in e.get("email", "").lower()]

    return events
