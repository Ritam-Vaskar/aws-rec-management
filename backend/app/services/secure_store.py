from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
SECRET_FILE = DATA_DIR / ".dashboard_secret"
AWS_SETTINGS_FILE = DATA_DIR / "aws-credentials.enc"
SESSION_COOKIE_NAME = "aws_dash_session"
SESSION_TTL_SECONDS = 60 * 60 * 8


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_secret() -> bytes:
    _ensure_data_dir()
    if SECRET_FILE.exists():
        return SECRET_FILE.read_bytes()

    secret = secrets.token_bytes(32)
    SECRET_FILE.write_bytes(secret)
    return secret


def _fernet() -> Fernet:
    secret = _load_secret()
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def _encode_token_payload(payload: dict[str, object]) -> str:
    raw_payload = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(_load_secret(), raw_payload, hashlib.sha256).digest()
    return ".".join(
        [
            base64.urlsafe_b64encode(raw_payload).decode("ascii").rstrip("="),
            base64.urlsafe_b64encode(signature).decode("ascii").rstrip("="),
        ]
    )


def _decode_token_payload(token: str) -> dict[str, object] | None:
    try:
        raw_payload_b64, signature_b64 = token.split(".", 1)
        raw_payload = base64.urlsafe_b64decode(_add_padding(raw_payload_b64))
        signature = base64.urlsafe_b64decode(_add_padding(signature_b64))
    except (ValueError, TypeError, base64.binascii.Error):
        return None

    expected = hmac.new(_load_secret(), raw_payload, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        payload = json.loads(raw_payload.decode("utf-8"))
    except json.JSONDecodeError:
        return None

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or exp < time.time():
        return None

    return payload


def _add_padding(value: str) -> str:
    return value + ("=" * (-len(value) % 4))


def create_session_token(username: str) -> str:
    return _encode_token_payload(
        {
            "sub": username,
            "iat": int(time.time()),
            "exp": int(time.time()) + SESSION_TTL_SECONDS,
            "nonce": secrets.token_urlsafe(16),
        }
    )


def verify_session_token(token: str) -> dict[str, object] | None:
    return _decode_token_payload(token)


def load_aws_credentials() -> dict[str, str]:
    if AWS_SETTINGS_FILE.exists():
        try:
            payload = _fernet().decrypt(AWS_SETTINGS_FILE.read_bytes())
            stored = json.loads(payload.decode("utf-8"))
            if isinstance(stored, dict):
                return {str(key): str(value) for key, value in stored.items()}
        except (InvalidToken, OSError, json.JSONDecodeError, ValueError):
            pass

    return {
        "AWS_ACCESS_KEY_ID": os.getenv("AWS_ACCESS_KEY_ID", ""),
        "AWS_SECRET_ACCESS_KEY": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
        "AWS_SESSION_TOKEN": os.getenv("AWS_SESSION_TOKEN", ""),
        "AWS_DEFAULT_REGION": os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
        "AWS_ASSUME_ROLE_ARN": os.getenv("AWS_ASSUME_ROLE_ARN", ""),
        "AWS_ASSUME_ROLE_SESSION_NAME": os.getenv("AWS_ASSUME_ROLE_SESSION_NAME", "aws-dash-dashboard"),
    }


def save_aws_credentials(credentials: dict[str, str]) -> None:
    _ensure_data_dir()
    AWS_SETTINGS_FILE.write_bytes(_fernet().encrypt(json.dumps(credentials, sort_keys=True).encode("utf-8")))


def mask_value(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def masked_aws_credentials(credentials: dict[str, str]) -> dict[str, str]:
    return {
        key: mask_value(value) if key != "AWS_DEFAULT_REGION" and key != "AWS_ASSUME_ROLE_SESSION_NAME" else value
        for key, value in credentials.items()
    }
