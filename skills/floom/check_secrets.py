#!/usr/bin/env python3
"""
Floom Secrets Checker — compares secrets needed by code against the platform.

Usage:
    python3 check_secrets.py '["ANTHROPIC_API_KEY", "STRIPE_KEY"]'
    echo '["ANTHROPIC_API_KEY"]' | python3 check_secrets.py

Reads config from ~/.claude/floom-config.json.

Outputs JSON:
  status "ok"  — which secrets are found/missing, plus full platform list
  status "error" — config or network problem, with fix guidance

Exit code 0 on ok, 1 on error.
"""

import json
import os
import sys
from typing import Any, Dict, List

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".claude", "floom-config.json")
DEFAULT_PLATFORM_URL = "https://dashboard.floom.dev"


def load_config():
    # type: () -> Dict[str, Any]
    if not os.path.isfile(CONFIG_PATH):
        return {"ok": False, "error": "Config not found at %s" % CONFIG_PATH,
                "fix": "Run preflight first: python3 ~/.claude/skills/floom/preflight.py"}
    try:
        with open(CONFIG_PATH) as f:
            config = json.load(f)
    except (ValueError, OSError) as e:
        return {"ok": False, "error": "Cannot read config: %s" % e,
                "fix": "Run preflight first: python3 ~/.claude/skills/floom/preflight.py"}

    api_key = config.get("api_key", "").strip()
    if not api_key or api_key == "PASTE_KEY_HERE":
        return {"ok": False, "error": "API key not configured",
                "fix": "Run preflight first: python3 ~/.claude/skills/floom/preflight.py"}

    return {"ok": True, "api_key": api_key,
            "platform_url": config.get("platform_url", DEFAULT_PLATFORM_URL).rstrip("/")}


def fetch_platform_secrets(api_key, platform_url):
    # type: (str, str) -> Dict[str, Any]
    """GET /api/secrets — returns list of secret names on the platform."""
    try:
        if sys.version_info[0] >= 3:
            from urllib.request import Request, urlopen
            from urllib.error import URLError, HTTPError
        else:
            from urllib2 import Request, urlopen, URLError, HTTPError  # type: ignore

        url = platform_url + "/api/secrets"
        req = Request(url)
        req.add_header("Authorization", "Bearer " + api_key)
        req.add_header("Accept", "application/json")

        resp = urlopen(req, timeout=10)
        data = json.loads(resp.read().decode("utf-8"))
        return {"ok": True, "secrets": data.get("secrets", [])}

    except HTTPError as e:
        if e.code == 401:
            return {"ok": False, "error": "API key is invalid or expired",
                    "fix": "Get a new key from dashboard.floom.dev/settings and update ~/.claude/floom-config.json"}
        return {"ok": False, "error": "HTTP %d from platform" % e.code,
                "fix": "Check the platform status and try again."}
    except URLError as e:
        return {"ok": False, "error": "Cannot reach platform: %s" % e.reason,
                "fix": "Check your internet connection."}
    except Exception as e:
        return {"ok": False, "error": str(e),
                "fix": "Run preflight first: python3 ~/.claude/skills/floom/preflight.py"}


def main():
    # Parse input
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = sys.stdin.read().strip()

    if not raw:
        print(json.dumps({"status": "ok", "found": [], "missing": [], "platform_secrets": []}))
        sys.exit(0)

    try:
        needed = json.loads(raw)
        if not isinstance(needed, list):
            raise ValueError("expected a JSON array")
    except (ValueError, TypeError) as e:
        print(json.dumps({"status": "error", "error": "Invalid input: %s" % e,
                           "fix": "Pass a JSON array of secret names, e.g. '[\"ANTHROPIC_API_KEY\"]'"}))
        sys.exit(1)

    if not needed:
        print(json.dumps({"status": "ok", "found": [], "missing": [], "platform_secrets": []}))
        sys.exit(0)

    # Load config
    config = load_config()
    if not config["ok"]:
        print(json.dumps({"status": "error", "error": config["error"], "fix": config["fix"]}))
        sys.exit(1)

    # Fetch platform secrets
    result = fetch_platform_secrets(config["api_key"], config["platform_url"])
    if not result["ok"]:
        print(json.dumps({"status": "error", "error": result["error"], "fix": result["fix"]}))
        sys.exit(1)

    platform_set = set(result["secrets"])
    missing = [n for n in needed if n not in platform_set]

    if not missing:
        print(json.dumps({"status": "ok", "message": "All secrets are on the platform."}))
    else:
        print(json.dumps({
            "status": "missing",
            "missing": missing,
            "platform_secrets": result["secrets"],
        }, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
