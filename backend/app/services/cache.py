import json
import os
import redis
from typing import Any

# ── Redis client ─────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# How long to keep resource data in cache. Override with CACHE_TTL_SECONDS.
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "3600"))

try:
    redis_client: redis.Redis | None = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    # Validate the connection eagerly so we fail fast on misconfiguration.
    redis_client.ping()
    print(f"[cache] Connected to Redis at {REDIS_URL}")
except Exception as e:
    print(f"[cache] Redis unavailable — running without cache ({e})")
    redis_client = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _cache_key(tenant_id: str) -> str:
    return f"resources:{tenant_id}"


# ── Public API ───────────────────────────────────────────────────────────────

def get_cached_resources(tenant_id: str = "default") -> list[dict[str, Any]] | None:
    if not redis_client:
        return None
    try:
        data = redis_client.get(_cache_key(tenant_id))
        if data:
            parsed = json.loads(data)
            # Treat empty list as a cache miss so we always re-fetch from AWS
            if isinstance(parsed, list) and len(parsed) > 0:
                return parsed
    except Exception as e:
        print(f"[cache] GET error for tenant={tenant_id}: {e}")
    return None


def set_cached_resources(data: list[dict[str, Any]], tenant_id: str = "default") -> None:
    if not redis_client:
        return
    if not data:
        # Don't cache empty results — always re-fetch from AWS next time
        print(f"[cache] Skipping cache set for tenant={tenant_id}: no resources to store")
        return
    try:
        redis_client.setex(_cache_key(tenant_id), CACHE_TTL, json.dumps(data))
        print(f"[cache] Stored {len(data)} resources for tenant={tenant_id} (TTL={CACHE_TTL}s)")
    except Exception as e:
        print(f"[cache] SET error for tenant={tenant_id}: {e}")


def update_cached_resource_tags(resource_id: str, tags: dict[str, str], tenant_id: str = "default") -> None:
    """Updates a specific resource's tags in-place inside the cache to avoid a full reload."""
    if not redis_client:
        return
    try:
        cached_data = get_cached_resources(tenant_id)
        if cached_data:
            updated = False
            for r in cached_data:
                if r.get("id") == resource_id:
                    r["tags"] = tags
                    updated = True
                    break
            if updated:
                set_cached_resources(cached_data, tenant_id)
                print(f"[cache] Updated tags for resource={resource_id} in tenant={tenant_id}")
    except Exception as e:
        print(f"[cache] Tag update error for resource={resource_id}: {e}")


def invalidate_cached_resources(tenant_id: str = "default") -> None:
    """Evict the cached resource list for a tenant, forcing a live AWS fetch on next request."""
    if not redis_client:
        return
    try:
        redis_client.delete(_cache_key(tenant_id))
        print(f"[cache] Invalidated cache for tenant={tenant_id}")
    except Exception as e:
        print(f"[cache] Invalidation error for tenant={tenant_id}: {e}")

