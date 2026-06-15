import base64
import json
from typing import Optional

from fastapi import APIRouter, Header


router = APIRouter(prefix="/auth", tags=["auth"])


def _decode_jwt_payload(token: str) -> dict:
    try:
        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        
        payload_b64 = parts[1]
        # Pad base64 string if necessary
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes)
    except Exception as e:
        print(f"Error decoding JWT: {e}")
        return {}


@router.get("/me")
def get_current_user(
    x_amzn_oidc_data: Optional[str] = Header(default=None)
) -> dict[str, object]:
    """
    Returns the currently authenticated user if deployed behind an AWS ALB.
    If no user is authenticated, returns a fallback dict.
    """
    if not x_amzn_oidc_data:
        return {
            "authenticated": False,
            "email": "Local Developer",
            "message": "Running locally without ALB auth."
        }
        
    payload = _decode_jwt_payload(x_amzn_oidc_data)
    
    # AWS SSO typically maps the user email to the 'email' or 'sub' claim
    email = payload.get("email", "Unknown User")
    
    return {
        "authenticated": True,
        "email": email,
        "claims": payload
    }
