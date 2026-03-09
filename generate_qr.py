#!/usr/bin/env python3
"""
Generate a QR code image that points to the redirect URL.
Reads QR_REDIRECT_BASE_URL from env or .env. Run once; print the image.
Changing the redirect target later does not require a new QR.
Requires: pip install qrcode[pil]
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

BASE_URL = os.environ.get("QR_REDIRECT_BASE_URL", "https://example.com/go")
OUTPUT_PATH = Path(__file__).resolve().parent / "qr-redirect.png"


def main():
    try:
        import qrcode
    except ImportError:
        print("Install with: pip install 'qrcode[pil]'")
        raise SystemExit(1)

    img = qrcode.make(BASE_URL)
    img.save(OUTPUT_PATH)
    print("QR code saved to:", OUTPUT_PATH)
    print("Content URL:", BASE_URL)


if __name__ == "__main__":
    main()
