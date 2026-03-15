# QR Redirect

Multiple short links: each has a **slug** (e.g. `ig`, `shop`) and a **redirect URL**.  
`/go/[slug]` redirects to that URL. In the admin UI you sign in with TOTP, then add links, edit links, view scan analytics, and download a QR image per link.

## Security

- The admin UI is protected by 6-digit TOTP.
- `/go/[slug]` and `/go` are public redirect endpoints.

## Quick start (Vercel + MongoDB)

1. Deploy this repo to Vercel (Next.js auto-detected).
2. Add environment variables in Vercel:
   - `AUTH_SECRET` (32+ chars), example: `openssl rand -base64 32`
   - `TOTP_SECRET` (generate with `npm run totp-setup`)
   - `MONGODB_DB` (e.g. `qr-code-generator-fw`)
   - Mongo URI, either:
     - `MONGODB_URI`, or
     - a prefixed variable such as `QRCG_MONGODB_URI` (supported by the app)
   - Optional: `NEXT_PUBLIC_APP_URL` for fixed public domain in generated QR links.
   - Optional: `REDIRECT_TARGET_URL` for legacy `/go` redirects.
3. Open the app and sign in with TOTP.

## Data model (MongoDB)

- `redirects`
  - `slug` (unique)
  - `target_url`
  - `name`
  - `note`
- `scan_logs`
  - `slug`
  - `scanned_at`
  - `ip`
  - `user_agent`
  - `referer`
  - `country`

The app auto-creates indexes:
- `redirects.slug` unique
- `scan_logs.slug`
- `scan_logs.scanned_at`
- `scan_logs (slug, scanned_at)`

## QR code compatibility

QR image content remains:
- `https://<your-domain>/go/<slug>` for slug links
- existing `/go` legacy redirects stay independent

So printed QR codes remain valid as long as slug data is preserved.

## One-time migration: Supabase -> MongoDB

If your existing data is in Supabase, run:

```bash
npm install
npm run migrate:supabase-to-mongodb
```

The script:
- reads Supabase credentials from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or prefixed via `SUPABASE_ENV_PREFIX`)
- reads Mongo credentials from `QRCG_MONGODB_URI`/`MONGODB_URI` + `MONGODB_DB`
- migrates `redirects`
- replaces Mongo `scan_logs` with Supabase `scan_logs` to keep counts exact
- verifies row counts match before success

## Env reference

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Session cookie encryption (32+ chars). |
| `TOTP_SECRET` | Base32 secret for TOTP login. |
| `MONGODB_URI` | MongoDB connection string (manual key). |
| `QRCG_MONGODB_URI` | Prefixed MongoDB URI (supported for Vercel integration). |
| `MONGODB_DB` | MongoDB database name used by the app. |
| `MONGODB_ENV_PREFIX` | Optional custom prefix resolver for Mongo vars. |
| `NEXT_PUBLIC_APP_URL` | Optional fixed public base URL for QR payload. |
| `REDIRECT_TARGET_URL` | Optional target for legacy `/go` endpoint. |
| `SUPABASE_URL` | Optional, only for migration script. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, only for migration script. |
| `SUPABASE_ENV_PREFIX` | Optional, only for migration script when using prefixed Supabase env vars. |

## TOTP setup

```bash
npm run totp-setup
```

Then add the generated `TOTP_SECRET` to `.env` and Vercel.
