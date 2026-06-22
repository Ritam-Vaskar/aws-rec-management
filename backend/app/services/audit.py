from __future__ import annotations

import json
from datetime import datetime, timezone

from app.auth.models import CurrentUser


def log_audit_event(action: str, user: CurrentUser, **details: object) -> None:
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "subject": user.subject,
        "email": user.email,
        "tenant_id": user.tenant_id,
        "roles": sorted(user.roles),
        **details,
    }
    print(f"[audit] {json.dumps(event, sort_keys=True)}")
