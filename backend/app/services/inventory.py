from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
import importlib
import os

from app.services.secure_store import load_aws_credentials


def _boto3():
    return importlib.import_module("boto3")


def _botocore_exceptions():
    exceptions_module = importlib.import_module("botocore.exceptions")
    return exceptions_module.BotoCoreError, exceptions_module.ClientError


def _aws_session():
    boto3 = _boto3()
    settings = load_aws_credentials()
    region = settings.get("AWS_DEFAULT_REGION", "us-east-1")
    access_key = settings.get("AWS_ACCESS_KEY_ID", "")
    secret_key = settings.get("AWS_SECRET_ACCESS_KEY", "")
    session_token = settings.get("AWS_SESSION_TOKEN", "")
    role_arn = settings.get("AWS_ASSUME_ROLE_ARN", "")
    role_session_name = settings.get("AWS_ASSUME_ROLE_SESSION_NAME", "aws-dash-dashboard")

    if access_key and secret_key:
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token,
            region_name=region,
        )
    else:
        session = boto3.Session(region_name=region)

    if not role_arn:
        return session

    sts = session.client("sts")
    assumed = sts.assume_role(RoleArn=role_arn, RoleSessionName=role_session_name)
    credentials = assumed["Credentials"]
    return boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        region_name=region,
    )


def _clean_tags(raw_tags: Iterable[dict[str, str]] | None) -> dict[str, str]:
    return {tag.get("Key", ""): tag.get("Value", "") for tag in raw_tags or [] if tag.get("Key")}


def _normalise_resource(
    *,
    resource_id: str,
    name: str,
    resource_type: str,
    region: str,
    account_id: str | None,
    ou: str | None,
    state: str | None,
    created: str | None,
    tags: dict[str, str],
) -> dict[str, object]:
    return {
        "id": resource_id,
        "name": name,
        "type": resource_type,
        "region": region,
        "account_id": account_id or "",
        "ou": ou or "",
        "state": state or "",
        "created": created or "",
        "tags": tags,
    }


def _account_id_from_arn(resource_arn: str) -> str:
    parts = resource_arn.split(":")
    return parts[4] if len(parts) > 4 else ""


def _list_s3_resources(session) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("s3")
    resources: list[dict[str, object]] = []
    for bucket in client.list_buckets().get("Buckets", []):
        bucket_name = bucket.get("Name", "")
        try:
            tag_response = client.get_bucket_tagging(Bucket=bucket_name)
            tags = _clean_tags(tag_response.get("TagSet"))
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code in {"NoSuchTagSet", "NoSuchBucket", "AccessDenied", "AccessDeniedException"}:
                tags = {}
            else:
                raise

        created = bucket.get("CreationDate")
        resources.append(
            _normalise_resource(
                resource_id=bucket_name,
                name=bucket_name,
                resource_type="S3 Bucket",
                region="global",
                account_id="",
                ou="",
                state="available",
                created=created.isoformat() if created else None,
                tags=tags,
            )
        )
    return resources


def _list_ec2_resources(session, region: str) -> list[dict[str, object]]:
    client = session.client("ec2", region_name=region)
    resources: list[dict[str, object]] = []
    paginator = client.get_paginator("describe_instances")
    for page in paginator.paginate():
        for reservation in page.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                tags = _clean_tags(instance.get("Tags"))
                resource_id = instance.get("InstanceId", "")
                resources.append(
                    _normalise_resource(
                        resource_id=resource_id,
                        name=tags.get("Name", resource_id),
                        resource_type="EC2 Instance",
                        region=region,
                        account_id=reservation.get("OwnerId", ""),
                        ou="",
                        state=instance.get("State", {}).get("Name", ""),
                        created=instance.get("LaunchTime").isoformat() if instance.get("LaunchTime") else None,
                        tags=tags,
                    )
                )
    return resources


def _list_rds_resources(session, region: str) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("rds", region_name=region)
    resources: list[dict[str, object]] = []
    paginator = client.get_paginator("describe_db_instances")
    for page in paginator.paginate():
        for db in page.get("DBInstances", []):
            arn = db.get("DBInstanceArn", "")
            try:
                tag_response = client.list_tags_for_resource(ResourceName=arn)
                tags = _clean_tags(tag_response.get("TagList"))
            except ClientError:
                tags = {}

            resources.append(
                _normalise_resource(
                    resource_id=db.get("DBInstanceIdentifier", arn),
                    name=db.get("DBInstanceIdentifier", arn),
                    resource_type="RDS Instance",
                    region=region,
                    account_id=_account_id_from_arn(arn) if arn else "",
                    ou="",
                    state=db.get("DBInstanceStatus", ""),
                    created=db.get("InstanceCreateTime").isoformat() if db.get("InstanceCreateTime") else None,
                    tags=tags,
                )
            )
    return resources


def _list_elbv2_resources(session, region: str) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("elbv2", region_name=region)
    resources: list[dict[str, object]] = []
    paginator = client.get_paginator("describe_load_balancers")
    for page in paginator.paginate():
        for lb in page.get("LoadBalancers", []):
            arn = lb.get("LoadBalancerArn", "")
            try:
                tag_response = client.describe_tags(ResourceArns=[arn])
                tag_descriptions = tag_response.get("TagDescriptions", [])
                tags = _clean_tags(tag_descriptions[0].get("Tags")) if tag_descriptions else {}
            except ClientError:
                tags = {}

            resources.append(
                _normalise_resource(
                    resource_id=arn,
                    name=lb.get("LoadBalancerName", arn),
                    resource_type="Load Balancer",
                    region=region,
                    account_id=_account_id_from_arn(arn) if arn else "",
                    ou="",
                    state=lb.get("State", {}).get("Code", ""),
                    created=lb.get("CreatedTime").isoformat() if lb.get("CreatedTime") else None,
                    tags=tags,
                )
            )
    return resources


def _list_tagged_resources(session, region: str) -> list[dict[str, object]]:
    client = session.client("resourcegroupstaggingapi", region_name=region)
    resources: list[dict[str, object]] = []
    paginator = client.get_paginator("get_resources")
    for page in paginator.paginate(ResourcesPerPage=50):
        for item in page.get("ResourceTagMappingList", []):
            arn = item.get("ResourceARN", "")
            tags = _clean_tags(item.get("Tags"))
            resources.append(
                _normalise_resource(
                    resource_id=arn,
                    name=arn.split("/")[-1] if arn else arn,
                    resource_type="Tagged Resource",
                    region=region,
                    account_id=_account_id_from_arn(arn) if arn else "",
                    ou="",
                    state="",
                    created=None,
                    tags=tags,
                )
            )
    return resources


def _iter_regions(session) -> list[str]:
    """Get list of regions to query. For performance, only use the configured region."""
    region = session.region_name or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    return [region]


def _collect_live_resources() -> list[dict[str, object]]:
    BotoCoreError, ClientError = _botocore_exceptions()
    session = _aws_session()
    resources: list[dict[str, object]] = []

    # Collect S3 resources (global)
    try:
        resources.extend(_list_s3_resources(session))
    except (ClientError, BotoCoreError) as e:
        print(f"Error collecting S3 resources: {e}")

    # Collect regional resources
    for region in _iter_regions(session):
        # EC2 Instances
        try:
            resources.extend(_list_ec2_resources(session, region))
        except (ClientError, BotoCoreError) as e:
            print(f"Error collecting EC2 resources in {region}: {e}")
        
        # RDS Instances
        try:
            resources.extend(_list_rds_resources(session, region))
        except (ClientError, BotoCoreError) as e:
            print(f"Error collecting RDS resources in {region}: {e}")
        
        # Skip ELBv2 and tagged resources for now to improve performance
        # for collector in (_list_elbv2_resources, _list_tagged_resources):
        #     try:
        #         resources.extend(collector(session, region))
        #     except (ClientError, BotoCoreError):
        #         continue

    # Deduplicate resources
    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, object]] = []
    for resource in resources:
        key = (str(resource.get("type", "")), str(resource.get("id", "")))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(resource)
    return deduped


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
    items = [deepcopy(resource) for resource in _collect_live_resources()]
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
    BotoCoreError, ClientError = _botocore_exceptions()
    session = _aws_session()
    resource_type_lower = resource_type.lower().strip()

    try:
        if resource_type_lower == "s3 bucket":
            client = session.client("s3")
            client.put_bucket_tagging(
                Bucket=resource_id,
                Tagging={"TagSet": [{"Key": key, "Value": value} for key, value in tags.items()]},
            )
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "global", "tags": tags}

        if resource_type_lower == "ec2 instance":
            client = session.client("ec2")
            client.create_tags(Resources=[resource_id], Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

        if resource_type_lower == "load balancer":
            client = session.client("elbv2")
            client.add_tags(ResourceArns=[resource_id], Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

        if resource_type_lower == "rds instance":
            client = session.client("rds")
            client.add_tags_to_resource(ResourceName=resource_id, Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

    except (ClientError, BotoCoreError) as exc:
        error_code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if error_code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            raise PermissionError(str(exc)) from exc
        error_code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if error_code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            raise PermissionError(str(exc)) from exc
        raise RuntimeError(str(exc)) from exc

    raise KeyError(f"Unsupported resource type: {resource_type}")
