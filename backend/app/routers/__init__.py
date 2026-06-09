from app.routers.auth import router as auth_router
from app.routers.resources import router as resources_router
from app.routers.settings import router as settings_router
from app.routers.tags import router as tags_router

__all__ = ["auth_router", "resources_router", "settings_router", "tags_router"]
