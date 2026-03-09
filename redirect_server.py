#!/usr/bin/env python3
"""
Redirect server for dynamic QR code target.
Uses REDIRECT_TARGET_URL from env (and .env) first, then config.json. Responds with HTTP 302.
Reloads on each request so target can be changed without restart.
"""

import json
import logging
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_PORT = 8765
HOST = "0.0.0.0"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def load_target_url() -> str | None:
    """Read target from REDIRECT_TARGET_URL env first, then config.json. Returns None if missing or invalid."""
    url = (os.environ.get("REDIRECT_TARGET_URL") or "").strip()
    if url:
        return url
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        url = (data.get("target_url") or "").strip()
        return url if url else None
    except (OSError, json.JSONDecodeError, TypeError) as e:
        logger.warning("Failed to load config: %s", e)
        return None


class RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Normalise path: treat /go, /go/, /r, /r/ as redirect endpoints
        path = (urlparse(self.path).path or "").rstrip("/")
        if path not in ("/go", "/r", ""):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        target = load_target_url()
        if not target:
            logger.warning("No target_url configured")
            self.send_response(503)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Redirect not configured")
            return

        self.send_response(302)
        self.send_header("Location", target)
        self.end_headers()
        logger.info("Redirect 302 to configured target")

    def log_message(self, format, *args):
        logger.info("%s - %s", self.address_string(), format % args)


def main():
    port = int(os.environ.get("QR_REDIRECT_PORT", DEFAULT_PORT))
    server = HTTPServer((HOST, port), RedirectHandler)
    logger.info("Redirect server listening on %s:%s (path: /go or /r)", HOST, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
