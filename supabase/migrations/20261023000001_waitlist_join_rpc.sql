-- Joining goes through one function that answers the same way whether or not the
-- address was already there, so the public key can't be used to probe the list.
create or replace function public.join_waitlist(email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (email) values (lower(trim(email)))
  on conflict (email) do nothing;
$$;

revoke all on function public.join_waitlist(text) from public;
grant execute on function public.join_waitlist(text) to anon;

drop policy if exists "anyone can join the waitlist" on public.waitlist;
revoke insert on public.waitlist from anon;

-- Signed-in users have no reason to call it.
revoke execute on function public.join_waitlist(text) from authenticated;
