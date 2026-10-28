-- Alerts can go to more than one person. Two more Vault secrets, both optional:
--   lab_inquiry_cc    a second recipient, copied on every alert
--   lab_inquiry_from  the sender, e.g. "Groove Lab <lab@groovedrinks.com>"
-- Resend's shared sender (onboarding@resend.dev) delivers only to the account
-- owner and rejects the whole message if anyone else is on it, so the CC is
-- attached only once the sender is on a verified domain of our own. Until then
-- the alert still goes to lab_inquiry_to alone, with a warning in the logs.
create or replace function public.notify_lab_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alerts_per_hour constant integer := 20;
  shared_sender constant text := 'Groove Lab <onboarding@resend.dev>';
  recent integer;
  api_key text;
  recipient text;
  cc text;
  sender text;
  stamp text;
  mail jsonb;
begin
  begin
    select count(*) into recent
      from public.lab_inquiries
      where created_at > now() - interval '1 hour';
    if recent > alerts_per_hour + 1 then
      raise warning 'lab_inquiries: % inquiries in the last hour, alert skipped', recent;
      return new;
    end if;

    select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
    select decrypted_secret into recipient from vault.decrypted_secrets where name = 'lab_inquiry_to';
    select decrypted_secret into cc from vault.decrypted_secrets where name = 'lab_inquiry_cc';
    select decrypted_secret into sender from vault.decrypted_secrets where name = 'lab_inquiry_from';
    if api_key is null or recipient is null then
      raise warning 'lab_inquiries: vault secrets resend_api_key / lab_inquiry_to missing, alert skipped';
      return new;
    end if;
    sender := coalesce(nullif(trim(sender), ''), shared_sender);
    cc := nullif(trim(cc), '');
    if cc is not null and sender like '%@resend.dev%' then
      raise warning 'lab_inquiries: lab_inquiry_cc ignored until lab_inquiry_from is on a verified domain';
      cc := null;
    end if;

    stamp := to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"');
    if recent > alerts_per_hour then
      mail := jsonb_build_object(
        'from', sender,
        'to', jsonb_build_array(recipient),
        'subject', 'Lab inquiry alerts paused',
        'text', recent || ' inquiries in the last hour, so alerts stop until it quiets down. '
          || 'Every row is still in public.lab_inquiries; read it there.' || E'\n\n' || stamp
      );
    else
      -- Email is safe in a subject: the column's check constraint allows no whitespace.
      mail := jsonb_build_object(
        'from', sender,
        'to', jsonb_build_array(recipient),
        'reply_to', new.email,
        'subject', 'Lab inquiry from ' || new.email,
        'text', new.message || E'\n\n— ' || new.email || ' · ' || stamp
      );
    end if;
    if cc is not null then
      mail := mail || jsonb_build_object('cc', jsonb_build_array(cc));
    end if;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := mail,
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'lab_inquiries: alert failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_lab_inquiry() from public;
