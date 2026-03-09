-- Table for short-link redirects: slug -> target_url
-- Run in Supabase Dashboard → SQL Editor, or via: supabase db push
create table if not exists public.redirects (
  slug text primary key,
  target_url text not null
);

comment on table public.redirects is 'Short links: /go/:slug redirects to target_url';
