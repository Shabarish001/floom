#!/usr/bin/env python3
"""
Floom Preflight — run before any skill operation.

Checks:
  1. Floom config exists and has a valid API key
  2. API key actually works (validates against the platform)
  3. (Future) Skill version check and auto-update

Usage:
    python3 preflight.py

Outputs JSON to stdout:
  - ready: bool
  - config_ok: bool
  - api_key_valid: bool
  - platform_url: str
  - org_name: str | null
  - error: str | null
  - skill_version: str

Exit code 0 if ready, 1 if not.
"""

import json
import os
import sys

SKILL_VERSION = "1.0.0"
DEFAULT_PLATFORM_URL = "https://dashboard.floom.dev"
CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".claude", "floom-config.json")


def load_config():
    # type: () -> dict
    """Load and validate floom-config.json."""
    if not os.path.isfile(CONFIG_PATH):
        return {"ok": False, "error": "not_configured", "detail": CONFIG_PATH}

    try:
        with open(CONFIG_PATH) as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        return {"ok": False, "error": "invalid_config", "detail": str(e)}

    api_key = config.get("api_key", "").strip()
    if not api_key or api_key == "PASTE_KEY_HERE":
        return {"ok": False, "error": "missing_api_key", "detail": "api_key is empty or placeholder"}

    platform_url = config.get("platform_url", DEFAULT_PLATFORM_URL).rstrip("/")

    return {
        "ok": True,
        "api_key": api_key,
        "platform_url": platform_url,
    }


def validate_api_key(api_key, platform_url):
    # type: (str, str) -> dict
    """Check the API key against the platform. Uses urllib to avoid dependencies."""
    try:
        if sys.version_info[0] >= 3:
            from urllib.request import Request, urlopen
            from urllib.error import URLError, HTTPError
        else:
            from urllib2 import Request, urlopen, URLError, HTTPError  # type: ignore

        url = platform_url + "/api/automations?q=__preflight_check__"
        req = Request(url)
        req.add_header("Authorization", "Bearer " + api_key)
        req.add_header("Accept", "application/json")

        resp = urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))

        # The automations endpoint returns a list — if we got here, the key works
        org_name = data.get("orgName", None)
        return {"valid": True, "org_name": org_name}

    except HTTPError as e:
        if e.code == 401:
            return {"valid": False, "error": "unauthorized", "detail": "API key is invalid or expired"}
        if e.code == 403:
            return {"valid": False, "error": "forbidden", "detail": "API key lacks permissions"}
        return {"valid": False, "error": "http_error", "detail": "HTTP %d" % e.code}
    except URLError as e:
        return {"valid": False, "error": "network_error", "detail": str(e.reason)}
    except Exception as e:
        return {"valid": False, "error": "unknown", "detail": str(e)}


def main():
    result = {
        "ready": False,
        "platform_url": DEFAULT_PLATFORM_URL,
        "org_name": None,
        "error": None,
        "fix": None,
        "skill_version": SKILL_VERSION,
    }

    # Step 1: Config check
    config = load_config()
    if not config["ok"]:
        if config["error"] == "not_configured":
            result["error"] = "Floom is not configured on this machine."
            result["fix"] = (
                "Ask the user for their API key from dashboard.floom.dev/settings, "
                "then run:\n"
                "mkdir -p ~/.claude && echo '{\"api_key\": \"USER_KEY\", "
                "\"platform_url\": \"https://dashboard.floom.dev\"}' > %s" % CONFIG_PATH
            )
        elif config["error"] == "missing_api_key":
            result["error"] = "Config file exists but API key is empty or still the placeholder."
            result["fix"] = (
                "Ask the user for their real API key from dashboard.floom.dev/settings, "
                "then overwrite %s with the correct key." % CONFIG_PATH
            )
        elif config["error"] == "invalid_config":
            result["error"] = "Config file is corrupted: %s" % config["detail"]
            result["fix"] = (
                "Delete %s and ask the user to re-enter their API key." % CONFIG_PATH
            )
        print(json.dumps(result, indent=2))
        sys.exit(1)
        return

    result["platform_url"] = config["platform_url"]

    # Step 2: Validate API key
    validation = validate_api_key(config["api_key"], config["platform_url"])
    if not validation["valid"]:
        err = validation.get("error", "unknown")
        if err == "unauthorized":
            result["error"] = "API key is invalid or expired."
            result["fix"] = (
                "Tell the user their API key no longer works. "
                "They need a new one from dashboard.floom.dev/settings, "
                "then update %s." % CONFIG_PATH
            )
        elif err == "network_error":
            result["error"] = "Cannot reach the Floom platform: %s" % validation.get("detail", "")
            result["fix"] = (
                "Tell the user to check their internet connection. "
                "If they're behind a VPN or firewall, they may need to allowlist %s." % config["platform_url"]
            )
        else:
            result["error"] = "API key check failed: %s" % validation.get("detail", err)
            result["fix"] = "Ask the user to verify their API key at dashboard.floom.dev/settings."
        print(json.dumps(result, indent=2))
        sys.exit(1)
        return

    result["org_name"] = validation.get("org_name")
    result["ready"] = True

    # Step 3: (Future) Version check and auto-update

    print(json.dumps(result, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
