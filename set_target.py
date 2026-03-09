#!/usr/bin/env python3
"""
Update the redirect target URL in config.json (optional fallback when REDIRECT_TARGET_URL is not set).
Validates that the URL uses http or https only (no javascript: etc).
Prefer setting REDIRECT_TARGET_URL in .env so no URL is stored in the repo.
"""

import json
import re
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
ALLOWED_SCHEMES = re.compile(r"^https?://", re.I)


def set_target_url(url: str) -> bool:
    url = (url or "").strip()
    if not url:
        print("Error: URL is empty", file=sys.stderr)
        return False
    if not ALLOWED_SCHEMES.match(url):
        print("Error: URL must start with http:// or https://", file=sys.stderr)
        return False
    try:
        data = {}
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        data["target_url"] = url
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Target URL updated in config.json")
        return True
    except (OSError, json.JSONDecodeError) as e:
        print("Error writing config:", e, file=sys.stderr)
        return False


def main():
    if len(sys.argv) != 2:
        print("Usage: python set_target.py <target_url>", file=sys.stderr)
        print("Example: python set_target.py https://example.com/landing", file=sys.stderr)
        sys.exit(1)
    ok = set_target_url(sys.argv[1])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
