"""
Expand AWS Secrets Manager JSON into individual environment variables at startup.
ECS task definitions inject a single APP_SECRETS env var containing a JSON blob
with all application secrets. This module expands that blob into os.environ so
that pydantic-settings can read them normally.

Only runs when APP_SECRETS is set (i.e. in ECS / production).
"""
import json
import os


def expand_secrets() -> None:
    raw = os.environ.get("APP_SECRETS")
    if not raw:
        return
    try:
        secrets = json.loads(raw)
        for key, value in secrets.items():
            if key not in os.environ:  # don't override values explicitly set in task env
                os.environ[key] = str(value)
    except json.JSONDecodeError:
        pass  # malformed secret — let the app fail naturally on missing config
