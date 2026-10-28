-- Brand inquiries from the /lab page. Same shape as the waitlist: the static site
-- writes with the public key through one SECURITY DEFINER function, the table itself
-- is closed, and nobody can read it through the API.

create extension if not exists pg_net;

create table if not exists public.lab_inquiries (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (email = lower(email) and length(email) <= 254 and email ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$'),
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.lab_inquiries enable row level security;
revoke all on public.lab_inquiries from anon, authenticated;

create or replace function public.submit_lab_inquiry(email text, message text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.lab_inquiries (email, message) values (lower(trim(email)), trim(message));
$$;

revoke all on function public.submit_lab_inquiry(text, text) from public;
grant execute on function public.submit_lab_inquiry(text, text) to anon;

-- Each inquiry emails the founders through Resend's HTTP API. The key and the
-- recipient live in Vault (resend_api_key, lab_inquiry_to), never in this file.
-- Mail is best effort: the row is already saved, so no mail failure may fail the insert.
create or replace function public.notify_lab_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- More than this many inquiries in an hour means a script, not brands; stop
  -- paying Resend's daily quota for it. Rows are still saved.
  alerts_per_hour constant integer := 20;
  recent integer;
  api_key text;
  recipient text;
begin
  begin
    select count(*) into recent
      from public.lab_inquiries
      where created_at > now() - interval '1 hour';
    if recent > alerts_per_hour then
      raise warning 'lab_inquiries: % inquiries in the last hour, alert skipped', recent;
      return new;
    end if;

    select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
    select decrypted_secret into recipient from vault.decrypted_secrets where name = 'lab_inquiry_to';
    if api_key is null or recipient is null then
      raise warning 'lab_inquiries: vault secrets resend_api_key / lab_inquiry_to missing, alert skipped';
      return new;
    end if;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Groove Lab <onboarding@resend.dev>',
        'to', jsonb_build_array(recipient),
        'reply_to', new.email,
        'subject', 'Lab inquiry from ' || new.email,
        'text', new.message || E'\n\n— ' || new.email || ' · ' || to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'lab_inquiries: alert failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_lab_inquiry() from public;

drop trigger if exists lab_inquiry_notify on public.lab_inquiries;
create trigger lab_inquiry_notify
  after insert on public.lab_inquiries
  for each row execute function public.notify_lab_inquiry();
