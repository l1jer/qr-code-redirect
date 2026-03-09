# QR Redirect

Multiple short links: each has a **slug** (e.g. `ig`, `shop`) and a **redirect URL**. The path `/go/[slug]` redirects to that URL. In the admin UI you sign in with TOTP (e.g. Google Authenticator), then add links, download a QR code per link, or delete links.

## Security

- The **admin UI** (home page) is protected: only users with a valid 6-digit TOTP code can access it.
- **/go/[slug]** is public (no auth); anyone who scans a QR or opens a link is redirected without logging in.

## Quick start (Vercel + Supabase)

1. **Supabase**: Create a project at [supabase.com](https://supabase.com). In **SQL Editor**, run the migration to create the `redirects` table:

   ```sql
   create table if not exists public.redirects (
     slug text primary key,
     target_url text not null
   );
   ```

   In **Project Settings → API** copy the **Project URL** and the **service_role** key (keep it secret).

2. **Deploy** the app from the repo root. Vercel will detect Next.js.

3. **Environment variables** (Vercel → Settings → Environment Variables):
   - `AUTH_SECRET`: session encryption key (min 32 chars). Example: `openssl rand -base64 32`
   - `TOTP_SECRET`: base32 TOTP secret for admin login. Generate: `npm run totp-setup`, then add the secret to your authenticator app and to this env var.
   - **Supabase** (pick one):
     - **Vercel one-click**: Connect Supabase in Vercel (Storage/Integrations), set the custom env prefix to e.g. `QRC`. Vercel will inject `QRC_SUPABASE_URL` and `QRC_SUPABASE_SERVICE_ROLE_KEY`. Add one variable: `SUPABASE_ENV_PREFIX=QRC` so the app reads those.
     - **Manual**: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase Project Settings → API.
   - Optional: `REDIRECT_TARGET_URL`: when Supabase is not configured, this single URL is exposed as slug **default** (read-only in UI).
   - Optional: `NEXT_PUBLIC_APP_URL`: public app URL (e.g. `https://your-app.vercel.app`) so QR codes use the correct domain.

4. Open the app, sign in with your TOTP code, then add links (slug + URL), download QR per link, or delete links.

## Multiple QR codes

- Each link has a **slug** (short name): letters, numbers, hyphen, underscore, 1–64 chars (e.g. `ig`, `shop`, `landing`).
- Short URL: `https://your-app.vercel.app/go/ig` redirects to the URL you set for `ig`.
- In the admin UI: **Add or update link** (slug + redirect URL). Same slug again updates the URL. Each row has **Open**, **QR** (download PNG), and **Delete**.

## TOTP setup

Run once to generate a TOTP secret:

```bash
npm install
npm run totp-setup
```

Add the printed `TOTP_SECRET` to your `.env` and to Vercel env. Add the same secret to Google Authenticator (or any TOTP app): type the secret manually or generate a QR from the printed `otpauth://...` URL and scan it.

## Env reference

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Session cookie encryption (32+ chars). Required for admin auth. |
| `TOTP_SECRET` | Base32 secret for TOTP; only holders can sign in. |
| `SUPABASE_URL` | Supabase project URL (manual setup). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (manual setup; server-only). |
| `SUPABASE_ENV_PREFIX` | When using Vercel’s Supabase integration with a custom prefix (e.g. `QRC`), set this to that prefix so the app reads `QRC_SUPABASE_URL` and `QRC_SUPABASE_SERVICE_ROLE_KEY`. |
| `REDIRECT_TARGET_URL` | Single fallback link when Supabase is not set; shown as slug **default**. |
| `NEXT_PUBLIC_APP_URL` | Optional; public app URL for QR payload. |

## Python (self-hosted, optional)

The repo includes a Python redirect server and scripts for non-Vercel use. For the web UI and multiple links, use the Next.js app and deploy to Vercel (or run `npm run build && npm start` elsewhere).
