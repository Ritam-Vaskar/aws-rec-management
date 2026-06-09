from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
SECRET_FILE = DATA_DIR / ".dashboard_secret"
CREDENTIALS_FILE = DATA_DIR / "aws-credentials.enc"
SESSION_TTL_SECONDS = 60 * 60 * 8

AWS_SETTING_KEYS = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_DEFAULT_REGION",
    "AWS_ASSUME_ROLE_ARN",
    "AWS_ASSUME_ROLE_SESSION_NAME",
)


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_master_secret() -> bytes:
    _ensure_data_dir()
    if SECRET_FILE.exists():
        return SECRET_FILE.read_bytes()

    secret = secrets.token_bytes(32)
    SECRET_FILE.write_bytes(secret)
    return secret


def _fernet() -> Fernet:
    secret = _load_master_secret()
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def _session_key() -> bytes:
    return hashlib.sha256(_load_master_secret() + b"session").digest()


def _b64encode_json(payload: dict[str, object]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode_json(value: str) -> dict[str, object]:
    padding = "=" * (-len(value) % 4)
    raw = base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Invalid token payload")
    return data


def create_session_token(subject: str) -> str:
    issued_at = int(time.time())
    payload = {"sub": subject, "iat": issued_at, "exp": issued_at + SESSION_TTL_SECONDS}
    payload_blob = _b64encode_json(payload)
    signature = hashlib.sha256(_session_key() + payload_blob.encode("ascii")).hexdigest()
    return f"{payload_blob}.{signature}"


def verify_session_token(token: str) -> dict[str, object] | None:
    try:
        payload_blob, signature = token.split(".", 1)
        expected = hashlib.sha256(_session_key() + payload_blob.encode("ascii")).hexdigest()
        if not secrets.compare_digest(signature, expected):
            return None

        payload = _b64decode_json(payload_blob)
        expires_at = int(payload.get("exp", 0))
        if expires_at < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def load_aws_settings() -> dict[str, str]:
    if CREDENTIALS_FILE.exists():
        try:
            payload = json.loads(_fernet().decrypt(CREDENTIALS_FILE.read_bytes()).decode("utf-8"))
            if isinstance(payload, dict):
                return {key: str(payload.get(key, "")) for key in AWS_SETTING_KEYS}
        except (InvalidToken, json.JSONDecodeError, UnicodeDecodeError):
            pass

    return {key: "" for key in AWS_SETTING_KEYS}


def save_aws_settings(settings: dict[str, str]) -> dict[str, str]:
    _ensure_data_dir()
    normalized = {key: str(settings.get(key, "")).strip() for key in AWS_SETTING_KEYS}
    payload = json.dumps(normalized, separators=(",", ":"), sort_keys=True).encode("utf-8")
    CREDENTIALS_FILE.write_bytes(_fernet().encrypt(payload))
    return normalized


def merged_aws_settings(*, overrides: dict[str, str] | None = None) -> dict[str, str]:
    settings = {key: value for key, value in load_aws_settings().items()}
    if overrides:
        for key in AWS_SETTING_KEYS:
            value = overrides.get(key)
            if value is not None and value.strip():
                settings[key] = value.strip()
    return settings


def masked_aws_settings(settings: dict[str, str]) -> dict[str, str]:
    masked: dict[str, str] = {}
    for key in AWS_SETTING_KEYS:
        value = settings.get(key, "")
        if not value:
            masked[key] = ""
        elif len(value) <= 8:
            masked[key] = "*" * len(value)
        else:
            masked[key] = f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"
    return masked
