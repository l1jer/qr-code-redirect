-- Table for short-link redirects: slug -> target_url, with optional name and note.
-- Run in Supabase Dashboard → SQL Editor, or via: supabase db push
create table if not exists public.redirects (
  slug text primary key,
  target_url text not null,
  name text not null default '',
  note text not null default ''
);

comment on table public.redirects is 'Short links: /go/:slug redirects to target_url';
