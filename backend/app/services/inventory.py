from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
import importlib
import os

from app.services.cache import get_cached_resources, set_cached_resources, update_cached_resource_tags


def _boto3():
    return importlib.import_module("boto3")


def _botocore_exceptions():
    exceptions_module = importlib.import_module("botocore.exceptions")
    return exceptions_module.BotoCoreError, exceptions_module.ClientError


def _aws_session(
    account_id: str | None = None,
    *,
    role_name: str | None = None,
    role_session_name: str | None = None,
):
    boto3 = _boto3()
    region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    access_key = os.getenv("AWS_ACCESS_KEY_ID") or None
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY") or None
    session_token = os.getenv("AWS_SESSION_TOKEN") or None
    role_arn = os.getenv("AWS_ASSUME_ROLE_ARN") or None
    default_role_name = os.getenv("AWS_ORG_ACCESS_ROLE_NAME", "OrganizationAccountAccessRole")
    effective_role_name = role_name or default_role_name
    effective_session_name = role_session_name or os.getenv("AWS_ASSUME_ROLE_SESSION_NAME", "aws-dash-dashboard")

    if access_key and secret_key:
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token,
            region_name=region,
        )
    else:
        session = boto3.Session(region_name=region)

    sts = session.client("sts")

    if account_id:
        try:
            target_role = f"arn:aws:iam::{account_id}:role/{effective_role_name}"
            assumed = sts.assume_role(RoleArn=target_role, RoleSessionName=effective_session_name)
            credentials = assumed["Credentials"]
            return boto3.Session(
                aws_access_key_id=credentials["AccessKeyId"],
                aws_secret_access_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
                region_name=region,
            )
        except Exception as e:
            print(f"Failed to assume role for account {account_id}: {e}")
            return None

    if not role_arn:
        return session

    assumed = sts.assume_role(RoleArn=role_arn, RoleSessionName=effective_session_name)
    credentials = assumed["Credentials"]
    return boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        region_name=region,
    )

def _get_org_accounts(session) -> list[dict[str, str]]:
    _, ClientError = _botocore_exceptions()
    accounts = []
    try:
        org_client = session.client("organizations")
        paginator = org_client.get_paginator("list_accounts")
        for page in paginator.paginate():
            for acc in page.get("Accounts", []):
                if acc.get("Status") == "ACTIVE":
                    account_id = acc.get("Id")
                    ou_name = ""
                    try:
                        parents = org_client.list_parents(ChildId=account_id).get("Parents", [])
                        if parents and parents[0]["Type"] == "ORGANIZATIONAL_UNIT":
                            ou_id = parents[0]["Id"]
                            ou_info = org_client.describe_organizational_unit(OrganizationalUnitId=ou_id)
                            ou_name = ou_info.get("OrganizationalUnit", {}).get("Name", "")
                        elif parents and parents[0]["Type"] == "ROOT":
                            ou_name = "Root"
                    except ClientError:
                        pass
                    accounts.append({"account_id": account_id, "ou": ou_name})
    except (ClientError, Exception) as e:
        print(f"Error fetching org accounts: {e}")
    return accounts


def _clean_tags(raw_tags: Iterable[dict[str, str]] | None) -> dict[str, str]:
    res = {}
    for tag in raw_tags or []:
        k = tag.get("Key") or tag.get("key")
        if k:
            v = tag.get("Value")
            if v is None:
                v = tag.get("value", "")
            res[k] = v
    return res


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


def _list_s3_resources(session, account_id: str = "") -> list[dict[str, object]]:
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
                account_id=account_id,  # populated by caller from STS identity
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


def _list_vpc_resources(session, region: str) -> list[dict[str, object]]:
    client = session.client("ec2", region_name=region)
    resources: list[dict[str, object]] = []
    try:
        paginator = client.get_paginator("describe_vpcs")
        for page in paginator.paginate():
            for vpc in page.get("Vpcs", []):
                tags = _clean_tags(vpc.get("Tags"))
                resource_id = vpc.get("VpcId", "")
                resources.append(
                    _normalise_resource(
                        resource_id=resource_id,
                        name=tags.get("Name", resource_id),
                        resource_type="VPC",
                        region=region,
                        account_id=vpc.get("OwnerId", ""),
                        ou="",
                        state=vpc.get("State", ""),
                        created=None,
                        tags=tags,
                    )
                )
    except Exception as e:
        print(f"[inventory] Error listing VPCs: {e}")
    return resources


def _list_subnet_resources(session, region: str) -> list[dict[str, object]]:
    client = session.client("ec2", region_name=region)
    resources: list[dict[str, object]] = []
    try:
        paginator = client.get_paginator("describe_subnets")
        for page in paginator.paginate():
            for subnet in page.get("Subnets", []):
                tags = _clean_tags(subnet.get("Tags"))
                resource_id = subnet.get("SubnetId", "")
                resources.append(
                    _normalise_resource(
                        resource_id=resource_id,
                        name=tags.get("Name", resource_id),
                        resource_type="Subnet",
                        region=region,
                        account_id=subnet.get("OwnerId", ""),
                        ou="",
                        state=subnet.get("State", ""),
                        created=None,
                        tags=tags,
                    )
                )
    except Exception as e:
        print(f"[inventory] Error listing Subnets: {e}")
    return resources


def _list_sg_resources(session, region: str) -> list[dict[str, object]]:
    client = session.client("ec2", region_name=region)
    resources: list[dict[str, object]] = []
    try:
        paginator = client.get_paginator("describe_security_groups")
        for page in paginator.paginate():
            for sg in page.get("SecurityGroups", []):
                tags = _clean_tags(sg.get("Tags"))
                resource_id = sg.get("GroupId", "")
                resources.append(
                    _normalise_resource(
                        resource_id=resource_id,
                        name=tags.get("Name", sg.get("GroupName", resource_id)),
                        resource_type="Security Group",
                        region=region,
                        account_id=sg.get("OwnerId", ""),
                        ou="",
                        state="",
                        created=None,
                        tags=tags,
                    )
                )
    except Exception as e:
        print(f"[inventory] Error listing Security Groups: {e}")
    return resources


def _list_cloudfront_resources(session) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("cloudfront")
    resources: list[dict[str, object]] = []
    try:
        paginator = client.get_paginator("list_distributions")
        for page in paginator.paginate():
            for dist in page.get("DistributionList", {}).get("Items", []):
                arn = dist.get("ARN", "")
                try:
                    tag_response = client.list_tags_for_resource(Resource=arn)
                    tag_items = tag_response.get("Tags", {}).get("Items", [])
                    tags = _clean_tags(tag_items)
                except ClientError:
                    tags = {}
                
                resources.append(
                    _normalise_resource(
                        resource_id=arn,
                        name=dist.get("DomainName", dist.get("Id", "")),
                        resource_type="CloudFront Distribution",
                        region="global",
                        account_id=_account_id_from_arn(arn) if arn else "",
                        ou="",
                        state=dist.get("Status", ""),
                        created=dist.get("LastModifiedTime").isoformat() if dist.get("LastModifiedTime") else None,
                        tags=tags,
                    )
                )
    except Exception as e:
        print(f"[inventory] Error listing CloudFront distributions: {e}")
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


def _list_lambda_resources(session, region: str) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("lambda", region_name=region)
    resources: list[dict[str, object]] = []
    paginator = client.get_paginator("list_functions")
    for page in paginator.paginate():
        for func in page.get("Functions", []):
            arn = func.get("FunctionArn", "")
            try:
                tag_response = client.list_tags(Resource=arn)
                tags = tag_response.get("Tags", {})
            except ClientError:
                tags = {}

            resources.append(
                _normalise_resource(
                    resource_id=arn,
                    name=func.get("FunctionName", arn),
                    resource_type="Lambda Function",
                    region=region,
                    account_id=_account_id_from_arn(arn) if arn else "",
                    ou="",
                    state=func.get("State", ""),
                    created=func.get("LastModified"),
                    tags=tags,
                )
            )
    return resources


def _list_ecs_resources(session, region: str) -> list[dict[str, object]]:
    _, ClientError = _botocore_exceptions()
    client = session.client("ecs", region_name=region)
    resources: list[dict[str, object]] = []
    try:
        paginator = client.get_paginator("list_clusters")
        for page in paginator.paginate():
            cluster_arns = page.get("clusterArns", [])
            if not cluster_arns:
                continue
            
            try:
                desc_resp = client.describe_clusters(clusters=cluster_arns, include=["TAGS"])
                for cluster in desc_resp.get("clusters", []):
                    arn = cluster.get("clusterArn", "")
                    tags = _clean_tags(cluster.get("tags"))
                    resources.append(
                        _normalise_resource(
                            resource_id=arn,
                            name=cluster.get("clusterName", arn),
                            resource_type="ECS Cluster",
                            region=region,
                            account_id=_account_id_from_arn(arn) if arn else "",
                            ou="",
                            state=cluster.get("status", ""),
                            created=None,
                            tags=tags,
                        )
                    )
            except ClientError:
                pass
    except Exception as e:
        print(f"[inventory] Error listing ECS clusters: {e}")
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
    """
    Get the list of regions to scan.

    Set ``AWS_SCAN_REGIONS`` to a comma-separated list of regions for multi-region
    scanning (e.g. ``us-east-1,eu-west-1,ap-south-1``).  When unset, only the
    configured default region is used (preserves the original single-region behaviour).
    """
    raw = os.getenv("AWS_SCAN_REGIONS", "").strip()
    if raw:
        regions = [r.strip() for r in raw.split(",") if r.strip()]
        if regions:
            return regions
    region = session.region_name or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    return [region]


def _get_current_account_id(session) -> str:
    """Get the account ID for the current session via STS."""
    try:
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        return identity.get("Account", "")
    except Exception as e:
        print(f"[inventory] Could not determine current account ID: {e}")
        return ""


def _filter_accounts(
    accounts: list[dict[str, str | None]],
    allowed_account_ids: frozenset[str] | set[str] | None,
) -> list[dict[str, str | None]]:
    if allowed_account_ids is None:
        return accounts
    return [account for account in accounts if account.get("account_id") in allowed_account_ids]


def collect_live_resources(
    tenant_id: str = "default",
    allowed_account_ids: frozenset[str] | set[str] | None = None,
) -> list[dict[str, object]]:
    BotoCoreError, ClientError = _botocore_exceptions()
    base_session = _aws_session()
    if not base_session:
        print("[inventory] ERROR: Could not create AWS session — check credentials")
        return []

    base_account_id = _get_current_account_id(base_session)

    resources: list[dict[str, object]] = []

    # Try org accounts first; fall back to single-account mode
    accounts = _get_org_accounts(base_session)
    if not accounts:
        print(f"[inventory] No org accounts found — falling back to current account: {base_account_id or 'unknown'}")
        accounts = [{"account_id": base_account_id or None, "ou": "Default"}]

    accounts = _filter_accounts(accounts, allowed_account_ids)
    if not accounts:
        print("[inventory] No allowed AWS accounts for this user scope")
        set_cached_resources([], tenant_id)
        return []

    print(f"[inventory] Scanning {len(accounts)} account(s)")

    for acc in accounts:
        account_id = acc["account_id"]
        ou = acc["ou"]

        session = _aws_session(account_id=account_id) if account_id and account_id != base_account_id else base_session
        if not session:
            print(f"[inventory] Skipping account {account_id} — could not assume role")
            continue

        effective_account = account_id or _get_current_account_id(session)
        print(f"[inventory] Scanning account={effective_account or 'unknown'} ou={ou}")

        try:
            s3_items = _list_s3_resources(session, account_id=effective_account)
            print(f"[inventory] S3: found {len(s3_items)} buckets")
            for r in s3_items:
                r["ou"] = ou
                resources.append(r)
        except (ClientError, BotoCoreError) as e:
            print(f"[inventory] Error collecting S3 resources: {e}")

        try:
            cf_items = _list_cloudfront_resources(session)
            print(f"[inventory] CloudFront: found {len(cf_items)} distributions")
            for r in cf_items:
                r["account_id"] = effective_account or r.get("account_id", "")
                r["ou"] = ou
                resources.append(r)
        except (ClientError, BotoCoreError) as e:
            print(f"[inventory] Error collecting CloudFront resources: {e}")

        for region in _iter_regions(session):
            try:
                ec2_items = _list_ec2_resources(session, region)
                print(f"[inventory] EC2 ({region}): found {len(ec2_items)} instances")
                for r in ec2_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting EC2 in {region}: {e}")

            try:
                vpc_items = _list_vpc_resources(session, region)
                print(f"[inventory] VPC ({region}): found {len(vpc_items)} vpcs")
                for r in vpc_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting VPCs in {region}: {e}")

            try:
                subnet_items = _list_subnet_resources(session, region)
                print(f"[inventory] Subnet ({region}): found {len(subnet_items)} subnets")
                for r in subnet_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting Subnets in {region}: {e}")

            try:
                sg_items = _list_sg_resources(session, region)
                print(f"[inventory] Security Group ({region}): found {len(sg_items)} groups")
                for r in sg_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting Security Groups in {region}: {e}")

            try:
                rds_items = _list_rds_resources(session, region)
                print(f"[inventory] RDS ({region}): found {len(rds_items)} instances")
                for r in rds_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting RDS in {region}: {e}")

            try:
                elbv2_items = _list_elbv2_resources(session, region)
                print(f"[inventory] ELBv2 ({region}): found {len(elbv2_items)} load balancers")
                for r in elbv2_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting ELBv2 in {region}: {e}")

            try:
                lambda_items = _list_lambda_resources(session, region)
                print(f"[inventory] Lambda ({region}): found {len(lambda_items)} functions")
                for r in lambda_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting Lambda in {region}: {e}")

            try:
                ecs_items = _list_ecs_resources(session, region)
                print(f"[inventory] ECS ({region}): found {len(ecs_items)} clusters")
                for r in ecs_items:
                    r["account_id"] = effective_account or r.get("account_id", "")
                    r["ou"] = ou
                    resources.append(r)
            except (ClientError, BotoCoreError) as e:
                print(f"[inventory] Error collecting ECS in {region}: {e}")

    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, object]] = []
    for resource in resources:
        key = (str(resource.get("type", "")), str(resource.get("id", "")))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(resource)

    print(f"[inventory] Total resources collected: {len(deduped)}")
    set_cached_resources(deduped, tenant_id)
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
    tenant_id: str = "default",
    allowed_account_ids: frozenset[str] | set[str] | None = None,
    force_refresh: bool = False,
) -> list[dict[str, object]]:
    items = None
    if not force_refresh:
        items = get_cached_resources(tenant_id)
        
    if items is None:
        items = [deepcopy(resource) for resource in collect_live_resources(tenant_id, allowed_account_ids)]

    return [
        resource
        for resource in items
        if allowed_account_ids is None or str(resource.get("account_id", "")) in allowed_account_ids
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


def update_resource_tags(
    *,
    resource_id: str,
    resource_type: str,
    tags: dict[str, str],
    account_id: str | None = None,
    tenant_id: str = "default",
    allowed_account_ids: frozenset[str] | set[str] | None = None,
) -> dict[str, object]:
    if allowed_account_ids is not None and account_id and account_id not in allowed_account_ids:
        raise PermissionError(f"Account {account_id} is outside the allowed scope")

    BotoCoreError, ClientError = _botocore_exceptions()
    # Use base session; only assume role if account_id is a different (cross-) account
    base_session = _aws_session()
    if not base_session:
        raise RuntimeError("Failed to create base AWS session — check credentials")

    current_account = _get_current_account_id(base_session)
    # Only assume role if account_id is explicitly a different account
    if account_id and account_id != current_account:
        tagging_role_name = os.getenv("AWS_TAGGING_ROLE_NAME") or os.getenv("AWS_ORG_ACCESS_ROLE_NAME", "OrganizationAccountAccessRole")
        session = _aws_session(account_id=account_id, role_name=tagging_role_name, role_session_name="AwsDashTagUpdate")
        if not session:
            raise RuntimeError(f"Failed to assume role for account {account_id}")
    else:
        session = base_session

    resource_type_lower = resource_type.lower().strip()

    try:
        if resource_type_lower == "s3 bucket":
            client = session.client("s3")
            client.put_bucket_tagging(
                Bucket=resource_id,
                Tagging={"TagSet": [{"Key": key, "Value": value} for key, value in tags.items()]},
            )
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "global", "tags": tags}

        if resource_type_lower in ("ec2 instance", "vpc", "subnet", "security group"):
            client = session.client("ec2")
            client.create_tags(Resources=[resource_id], Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

        if resource_type_lower == "load balancer":
            client = session.client("elbv2")
            client.add_tags(ResourceArns=[resource_id], Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

        if resource_type_lower == "rds instance":
            client = session.client("rds")
            client.add_tags_to_resource(ResourceName=resource_id, Tags=[{"Key": key, "Value": value} for key, value in tags.items()])
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "", "tags": tags}

        if resource_type_lower == "cloudfront distribution":
            client = session.client("cloudfront")
            client.tag_resource(Resource=resource_id, Tags={"Items": [{"Key": key, "Value": value} for key, value in tags.items()]})
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": "global", "tags": tags}

        if resource_type_lower == "lambda function":
            arn_parts = resource_id.split(":")
            region_name = arn_parts[3] if len(arn_parts) > 3 else None
            client = session.client("lambda", region_name=region_name) if region_name else session.client("lambda")
            client.tag_resource(Resource=resource_id, Tags=tags)
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": region_name or "", "tags": tags}

        if resource_type_lower == "ecs cluster":
            arn_parts = resource_id.split(":")
            region_name = arn_parts[3] if len(arn_parts) > 3 else None
            client = session.client("ecs", region_name=region_name) if region_name else session.client("ecs")
            client.tag_resource(resourceArn=resource_id, tags=[{"key": k, "value": v} for k, v in tags.items()])
            update_cached_resource_tags(resource_id, tags, tenant_id)
            return {"id": resource_id, "name": resource_id, "type": resource_type, "region": region_name or "", "tags": tags}

    except (ClientError, BotoCoreError) as exc:
        error_code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if error_code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            raise PermissionError(str(exc)) from exc
        raise RuntimeError(str(exc)) from exc

    raise KeyError(f"Unsupported resource type: {resource_type}")
