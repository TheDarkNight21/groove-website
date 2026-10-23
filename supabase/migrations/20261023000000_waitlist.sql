create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(email) and length(email) <= 254 and email ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$'),
  created_at timestamptz not null default now()
);

-- The static site writes with the public anon key: it may insert, and nothing else.
-- No select policy, so nobody can read the list through the API.
alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;
grant insert (email) on public.waitlist to anon;

create policy "anyone can join the waitlist"
  on public.waitlist for insert to anon
  with check (true);
