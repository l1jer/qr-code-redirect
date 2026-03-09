# QR redirect

One fixed URL (e.g. `https://your-domain.com/go`) that 302-redirects to a target you can change anytime. Print the QR once; update the target via env or config.

## Setup (no secrets in repo)

1. Copy `.env.example` to `.env` and set your values. Do not commit `.env` (it is in `.gitignore`).
2. **Redirect target**: set `REDIRECT_TARGET_URL` in `.env` (or in Vercel env vars). Python server and Vercel both use this. Optional fallback: `target_url` in `config.json` or `python set_target.py "<url>"` (writes to `config.json`).
3. **QR code**: set `QR_REDIRECT_BASE_URL` in `.env` to your public redirect URL (e.g. `https://your-app.vercel.app/go`). Run `python generate_qr.py` to produce `qr-redirect.png`. Changing the target later does not require a new QR.

## Vercel

1. New project, root = `vercel/` (or repo root if `vercel/` is at root).
2. **Settings → Environment Variables**: set `REDIRECT_TARGET_URL` to your target URL.
3. Optional: **Settings → Domains** → add a subdomain and the CNAME record.
4. QR content = `https://your-project.vercel.app/go` or your custom domain `/go`. To change target later, update `REDIRECT_TARGET_URL` and redeploy.

## Python (self-hosted)

1. Set `REDIRECT_TARGET_URL` in `.env` (recommended), or `target_url` in `config.json`, or run `python set_target.py "<url>"`.
2. Run `python redirect_server.py` (serves `/go` and `/r` on port 8765, or `QR_REDIRECT_PORT` from env).
3. QR content = your public URL to `/go`. Change target in `.env` or `config.json` anytime; no restart needed.

## Env reference

| Variable | Purpose |
|----------|---------|
| `REDIRECT_TARGET_URL` | Where `/go` and `/r` redirect to (env overrides `config.json`). |
| `QR_REDIRECT_BASE_URL` | URL used as QR payload when running `generate_qr.py`. |
| `QR_REDIRECT_PORT` | Optional; port for Python server (default 8765). |
