-- Scan analytics: one row per QR scan / redirect hit.
-- Does NOT modify the existing redirects table.
create table if not exists public.scan_logs (
  id bigint generated always as identity primary key,
  slug text not null,
  scanned_at timestamptz not null default now(),
  ip text,
  user_agent text,
  referer text,
  country text
);

create index if not exists idx_scan_logs_slug on public.scan_logs (slug);
create index if not exists idx_scan_logs_scanned_at on public.scan_logs (scanned_at);

comment on table public.scan_logs is 'One row per QR scan; used for analytics in the admin dashboard.';
