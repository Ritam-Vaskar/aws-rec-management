from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class CurrentUser:
    subject: str
    email: str
    name: str
    tenant_id: str
    roles: frozenset[str]
    groups: frozenset[str]
    allowed_account_ids: frozenset[str] | None

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles

    def can_access_account(self, account_id: str | None) -> bool:
        if not account_id or self.allowed_account_ids is None:
            return True
        return account_id in self.allowed_account_ids

    def cache_scope(self) -> str:
        if self.allowed_account_ids is None:
            return self.tenant_id
        digest = hashlib.sha256(",".join(sorted(self.allowed_account_ids)).encode()).hexdigest()[:12]
        return f"{self.tenant_id}:{digest}"
