-- Add name and note columns to existing redirects table.
-- Safe to run if columns already exist (uses IF NOT EXISTS via DO block).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'redirects' and column_name = 'name'
  ) then
    alter table public.redirects add column name text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'redirects' and column_name = 'note'
  ) then
    alter table public.redirects add column note text not null default '';
  end if;
end $$;
