from __future__ import annotations

import logging
from app.services.inventory import _aws_session, _get_current_account_id, _botocore_exceptions

logger = logging.getLogger(__name__)

def perform_action(
    *,
    resource_id: str,
    resource_type: str,
    action: str,
    account_id: str | None = None,
    region: str | None = None
) -> dict[str, object]:
    """
    Perform a state action (start, stop, reboot, terminate, delete) on a resource.
    """
    BotoCoreError, ClientError = _botocore_exceptions()
    base_session = _aws_session()
    if not base_session:
        raise RuntimeError("Failed to create base AWS session — check credentials")

    current_account = _get_current_account_id(base_session)
    if account_id and account_id != current_account:
        session = _aws_session(account_id=account_id)
        if not session:
            raise RuntimeError(f"Failed to assume role for account {account_id}")
    else:
        session = base_session

    resource_type_lower = resource_type.lower().strip()
    action_lower = action.lower().strip()

    valid_actions = {"start", "stop", "reboot", "terminate", "delete"}
    if action_lower not in valid_actions:
        raise ValueError(f"Invalid action: {action}")

    try:
        # EC2
        if resource_type_lower == "ec2 instance":
            client = session.client("ec2", region_name=region or session.region_name or "us-east-1")
            if action_lower == "start":
                client.start_instances(InstanceIds=[resource_id])
            elif action_lower == "stop":
                client.stop_instances(InstanceIds=[resource_id])
            elif action_lower == "reboot":
                client.reboot_instances(InstanceIds=[resource_id])
            elif action_lower == "terminate":
                client.terminate_instances(InstanceIds=[resource_id])
            else:
                raise ValueError(f"Action '{action}' is not supported for EC2 instances.")
            
            return {"status": "success", "action": action, "resource_id": resource_id}

        # RDS
        if resource_type_lower == "rds instance":
            client = session.client("rds", region_name=region or session.region_name or "us-east-1")
            if action_lower == "start":
                client.start_db_instance(DBInstanceIdentifier=resource_id)
            elif action_lower == "stop":
                client.stop_db_instance(DBInstanceIdentifier=resource_id)
            elif action_lower == "reboot":
                client.reboot_db_instance(DBInstanceIdentifier=resource_id)
            else:
                raise ValueError(f"Action '{action}' is not supported for RDS instances.")
            
            return {"status": "success", "action": action, "resource_id": resource_id}

        # S3 Bucket
        if resource_type_lower == "s3 bucket":
            client = session.client("s3")
            if action_lower == "delete":
                client.delete_bucket(Bucket=resource_id)
            else:
                raise ValueError(f"Action '{action}' is not supported for S3 buckets.")
            
            return {"status": "success", "action": action, "resource_id": resource_id}

    except (ClientError, BotoCoreError) as exc:
        error_code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        error_message = getattr(exc, "response", {}).get("Error", {}).get("Message", str(exc))
        if error_code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            raise PermissionError(f"Permission denied: {error_message}") from exc
        raise RuntimeError(f"AWS Error ({error_code}): {error_message}") from exc

    raise KeyError(f"Unsupported resource type for actions: {resource_type}")
