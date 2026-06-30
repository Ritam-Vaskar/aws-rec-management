from app.routers.resources import router as resources_router
from app.routers.tags import router as tags_router
from app.routers.audit import router as audit_router
from app.routers.accounts import router as accounts_router

__all__ = ["resources_router", "tags_router", "audit_router", "accounts_router"]

