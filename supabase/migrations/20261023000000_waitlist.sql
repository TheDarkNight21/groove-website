create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 254),
  created_at timestamptz not null default now()
);

-- Only the server (service role) touches this table; no public policies.
alter table public.waitlist enable row level security;
