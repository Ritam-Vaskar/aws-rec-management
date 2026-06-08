from __future__ import annotations

from copy import deepcopy


_RESOURCES: list[dict[str, object]] = [
    {
        "id": "my-proto-bucket-prod",
        "name": "my-proto-bucket-prod",
        "type": "S3 Bucket",
        "region": "global",
        "account_id": "111111111111",
        "ou": "platform",
        "state": "available",
        "created": "2026-06-01T10:00:00Z",
        "tags": {"env": "prod", "team": "platform"},
    },
    {
        "id": "my-proto-bucket-dev",
        "name": "my-proto-bucket-dev",
        "type": "S3 Bucket",
        "region": "global",
        "account_id": "111111111111",
        "ou": "engineering",
        "state": "available",
        "created": "2026-06-02T10:00:00Z",
        "tags": {},
    },
    {
        "id": "i-0abc1234def567890",
        "name": "payments-api-1",
        "type": "EC2 Instance",
        "region": "us-east-1",
        "account_id": "111111111111",
        "ou": "payments",
        "state": "running",
        "created": "2026-06-03T10:00:00Z",
        "tags": {"env": "prod", "owner": "team-a"},
    },
    {
        "id": "db-01",
        "name": "orders-db",
        "type": "RDS Instance",
        "region": "eu-west-1",
        "account_id": "222222222222",
        "ou": "data",
        "state": "available",
        "created": "2026-06-04T10:00:00Z",
        "tags": {"env": "staging"},
    },
    {
        "id": "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/proto/50dc6c495c0c9188",
        "name": "proto-alb",
        "type": "Load Balancer",
        "region": "us-east-1",
        "account_id": "111111111111",
        "ou": "platform",
        "state": "active",
        "created": "2026-06-05T10:00:00Z",
        "tags": {"team": "platform"},
    },
]


def _resource_matches(
    resource: dict[str, object],
    *,
    search: str | None,
    resource_type: str | None,
    region: str | None,
    tag_key: str | None,
    tag_value: str | None,
    untagged_only: bool,
) -> bool:
    tags = resource.get("tags", {})
    if not isinstance(tags, dict):
        tags = {}

    if resource_type and resource.get("type") != resource_type:
        return False
    if region and resource.get("region") != region:
        return False
    if untagged_only and tags:
        return False
    if tag_key and tag_key not in tags:
        return False
    if tag_key and tag_value is not None and tags.get(tag_key) != tag_value:
        return False
    if search:
        haystack = " ".join(
            str(part).lower()
            for part in [
                resource.get("id", ""),
                resource.get("name", ""),
                resource.get("type", ""),
                resource.get("region", ""),
                resource.get("account_id", ""),
                resource.get("ou", ""),
                " ".join(f"{k}={v}" for k, v in tags.items()),
            ]
        )
        if search.lower() not in haystack:
            return False
    return True


def list_resources(
    *,
    search: str | None = None,
    resource_type: str | None = None,
    region: str | None = None,
    tag_key: str | None = None,
    tag_value: str | None = None,
    untagged_only: bool = False,
) -> list[dict[str, object]]:
    items = [deepcopy(resource) for resource in _RESOURCES]
    return [
        resource
        for resource in items
        if _resource_matches(
            resource,
            search=search,
            resource_type=resource_type,
            region=region,
            tag_key=tag_key,
            tag_value=tag_value,
            untagged_only=untagged_only,
        )
    ]


def update_resource_tags(*, resource_id: str, resource_type: str, tags: dict[str, str]) -> dict[str, object]:
    for resource in _RESOURCES:
        if resource.get("id") == resource_id and resource.get("type") == resource_type:
            existing_tags = resource.setdefault("tags", {})
            if not isinstance(existing_tags, dict):
                existing_tags = {}
                resource["tags"] = existing_tags
            existing_tags.update(tags)
            return deepcopy(resource)

    raise KeyError(f"Resource not found: {resource_id}")
