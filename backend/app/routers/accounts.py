from fastapi import APIRouter, Depends

from app.auth.dependencies import require_permission
from app.auth.models import CurrentUser
from app.services.inventory import get_accounts_with_ou


router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("")
def list_accounts(
    user: CurrentUser = Depends(require_permission("resources:read")),
) -> list[dict]:
    """
    Return all AWS accounts with their OU grouping, resource counts, and
    compliance scores derived from the live resource inventory.
    """
    return get_accounts_with_ou(
        tenant_id=user.cache_scope(),
        allowed_account_ids=user.allowed_account_ids,
    )
