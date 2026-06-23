from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any

from app.auth.models import CurrentUser

# ── Audit logger setup ───────────────────────────────────────────────────────

_AUDIT_LOG_FILE = os.getenv("AUDIT_LOG_FILE", "audit.log")
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_BACKUP_COUNT = 5

_logger = logging.getLogger("audit")
_logger.setLevel(logging.INFO)
_logger.propagate = False  # don't double-log to root logger

# stdout handler (structured JSON, one line per event)
_stdout_handler = logging.StreamHandler()
_stdout_handler.setFormatter(logging.Formatter("%(message)s"))
_logger.addHandler(_stdout_handler)

# rotating file handler — survives restarts; kept out of .gitignore by design
try:
    _file_handler = RotatingFileHandler(
        _AUDIT_LOG_FILE,
        maxBytes=_MAX_BYTES,
        backupCount=_BACKUP_COUNT,
        encoding="utf-8",
    )
    _file_handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_file_handler)
except OSError as _e:
    print(f"[audit] WARNING: could not open audit log file {_AUDIT_LOG_FILE!r}: {_e}")


# ── Public API ───────────────────────────────────────────────────────────────

def log_audit_event(action: str, user: CurrentUser, **details: object) -> None:
    """Write a single audit event as a JSON line to stdout and the audit log file."""
    event: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "subject": user.subject,
        "email": user.email,
        "tenant_id": user.tenant_id,
        "roles": sorted(user.roles),
        **details,
    }
    _logger.info(json.dumps(event, sort_keys=True))


def get_recent_audit_events(n: int = 100) -> list[dict[str, Any]]:
    """
    Return the last *n* audit events from the log file (newest first).
    Returns an empty list if the file is not available or not parseable.
    """
    events: list[dict[str, Any]] = []
    if not os.path.isfile(_AUDIT_LOG_FILE):
        return events
    try:
        with open(_AUDIT_LOG_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except OSError:
        pass
    return list(reversed(events[-n:]))

