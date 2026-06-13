import json
import os
import redis
from typing import Any

# Initialize Redis client
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    print(f"Failed to connect to Redis: {e}")
    redis_client = None

def get_cached_resources(tenant_id: str = "default") -> list[dict[str, Any]] | None:
    if not redis_client:
        return None
    try:
        data = redis_client.get(f"resources:{tenant_id}")
        if data:
            parsed = json.loads(data)
            # Treat empty list as a cache miss so we always re-fetch from AWS
            if isinstance(parsed, list) and len(parsed) > 0:
                return parsed
    except Exception as e:
        print(f"Redis get error: {e}")
    return None

def set_cached_resources(data: list[dict[str, Any]], tenant_id: str = "default") -> None:
    if not redis_client:
        return
    if not data:
        # Don't cache empty results — always re-fetch from AWS next time
        print("[cache] Skipping cache set: no resources to store")
        return
    try:
        # Cache for 1 hour by default
        redis_client.setex(f"resources:{tenant_id}", 3600, json.dumps(data))
        print(f"[cache] Stored {len(data)} resources in cache for tenant={tenant_id}")
    except Exception as e:
        print(f"Redis set error: {e}")

def update_cached_resource_tags(resource_id: str, tags: dict[str, str], tenant_id: str = "default") -> None:
    """Updates a specific resource's tags directly in the cache to avoid full reload."""
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
    except Exception as e:
        print(f"Redis update tags error: {e}")
