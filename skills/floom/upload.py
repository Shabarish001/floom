#!/usr/bin/env python3
"""
Floom Upload — zips a project directory and uploads it as an artifact.

Usage:
    python3 upload.py <project_dir> --entrypoint <file> --manifest <manifest.json>

Handles the 3-step upload:
  1. POST /api/artifacts/upload-url → get presigned URL
  2. PUT zip to presigned URL
  3. POST /api/artifacts → validate and create artifact

Outputs JSON:
  status "ok"  — artifact created, includes artifactId
  status "error" — with error and fix fields

Exit code 0 on ok, 1 on error.
"""

import io
import json
import os
import sys
import zipfile
from typing import Any, Dict

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".claude", "floom-config.json")
DEFAULT_PLATFORM_URL = "https://dashboard.floom.dev"

def load_config():
    # type: () -> Dict[str, Any]
    if not os.path.isfile(CONFIG_PATH):
        return {"ok": False, "error": "Config not found", "fix": "Run preflight first."}
    try:
        with open(CONFIG_PATH) as f:
            config = json.load(f)
    except (ValueError, OSError) as e:
        return {"ok": False, "error": "Cannot read config: %s" % e, "fix": "Run preflight first."}

    api_key = config.get("api_key", "").strip()
    if not api_key or api_key == "PASTE_KEY_HERE":
        return {"ok": False, "error": "API key not configured", "fix": "Run preflight first."}

    return {"ok": True, "api_key": api_key,
            "platform_url": config.get("platform_url", DEFAULT_PLATFORM_URL).rstrip("/")}


def make_zip(project_dir):
    # type: (str) -> bytes
    """Create a zip of the project directory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_dir):
            for fname in files:
                full_path = os.path.join(root, fname)
                arc_name = os.path.relpath(full_path, project_dir)
                zf.write(full_path, arc_name)
    return buf.getvalue()


def api_request(url, api_key, method="GET", data=None, content_type="application/json"):
    # type: (str, str, str, Any, str) -> Dict[str, Any]
    """Make an HTTP request using urllib."""
    if sys.version_info[0] >= 3:
        from urllib.request import Request, urlopen
        from urllib.error import URLError, HTTPError
    else:
        from urllib2 import Request, urlopen, URLError, HTTPError  # type: ignore

    req = Request(url, method=method)
    req.add_header("Authorization", "Bearer " + api_key)

    body = None  # type: Any
    if data is not None:
        if isinstance(data, bytes):
            body = data
            req.add_header("Content-Type", content_type)
        else:
            body = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")

    try:
        resp = urlopen(req, body, timeout=60)
        resp_body = resp.read().decode("utf-8")
        if resp_body:
            return {"ok": True, "data": json.loads(resp_body)}
        return {"ok": True, "data": {}}
    except HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            msg = err_body.get("error", str(e))
        except Exception:
            msg = "HTTP %d" % e.code
        return {"ok": False, "error": msg, "code": e.code}
    except URLError as e:
        return {"ok": False, "error": "Network error: %s" % e.reason}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def put_bytes(url, data, content_type):
    # type: (str, bytes, str) -> Dict[str, Any]
    """PUT raw bytes to a URL (for presigned upload)."""
    if sys.version_info[0] >= 3:
        from urllib.request import Request, urlopen
        from urllib.error import URLError, HTTPError
    else:
        from urllib2 import Request, urlopen, URLError, HTTPError  # type: ignore

    req = Request(url, data=data, method="PUT")
    req.add_header("Content-Type", content_type)

    try:
        urlopen(req, timeout=120)
        return {"ok": True}
    except HTTPError as e:
        return {"ok": False, "error": "Upload failed: HTTP %d" % e.code}
    except URLError as e:
        return {"ok": False, "error": "Upload failed: %s" % e.reason}
    except Exception as e:
        return {"ok": False, "error": "Upload failed: %s" % e}


def upload_artifact(project_dir, entrypoint, manifest, api_key, platform_url):
    # type: (str, str, dict, str, str) -> Dict[str, Any]
    """Zip, upload, and create artifact. Returns artifactId or error."""

    # Step 1: Get presigned upload URL
    step1 = api_request(platform_url + "/api/artifacts/upload-url", api_key, method="POST")
    if not step1["ok"]:
        return {"status": "error", "error": "Failed to get upload URL: %s" % step1["error"],
                "fix": "Check your API key and network connection."}

    upload_url = step1["data"]["uploadUrl"]
    r2_key = step1["data"]["r2Key"]

    # Step 2: Zip and upload
    try:
        zip_bytes = make_zip(project_dir)
    except Exception as e:
        return {"status": "error", "error": "Failed to create zip: %s" % e,
                "fix": "Check file permissions in %s." % project_dir}

    step2 = put_bytes(upload_url, zip_bytes, "application/zip")
    if not step2["ok"]:
        return {"status": "error", "error": step2["error"],
                "fix": "Try again. If it persists, check your network."}

    # Step 3: Create artifact
    payload = {"manifest": manifest, "entrypoint": entrypoint, "r2Key": r2_key}
    step3 = api_request(platform_url + "/api/artifacts", api_key, method="POST", data=payload)
    if not step3["ok"]:
        return {"status": "error", "error": "Artifact creation failed: %s" % step3["error"],
                "fix": "Check the manifest and entrypoint, then try again."}

    return {"status": "ok", "artifactId": step3["data"]["artifactId"]}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Zip and upload a floom artifact")
    parser.add_argument("project_dir", help="Path to project directory")
    parser.add_argument("--entrypoint", required=True, help="Entrypoint file relative to project dir")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    args = parser.parse_args()

    # Validate inputs
    if not os.path.isdir(args.project_dir):
        print(json.dumps({"status": "error", "error": "Project directory not found: %s" % args.project_dir,
                           "fix": "Check the path."}))
        sys.exit(1)

    ep_path = os.path.join(args.project_dir, args.entrypoint)
    if not os.path.isfile(ep_path):
        print(json.dumps({"status": "error", "error": "Entrypoint not found: %s" % ep_path,
                           "fix": "Check the --entrypoint path."}))
        sys.exit(1)

    try:
        with open(args.manifest) as f:
            manifest = json.load(f)
    except (ValueError, OSError) as e:
        print(json.dumps({"status": "error", "error": "Cannot read manifest: %s" % e,
                           "fix": "Check the --manifest path."}))
        sys.exit(1)

    # Load config
    config = load_config()
    if not config["ok"]:
        print(json.dumps({"status": "error", "error": config["error"], "fix": config["fix"]}))
        sys.exit(1)

    result = upload_artifact(args.project_dir, args.entrypoint, manifest, config["api_key"], config["platform_url"])
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["status"] == "ok" else 1)


if __name__ == "__main__":
    main()
