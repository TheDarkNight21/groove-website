-- Orders from Stripe Checkout. Written only by the server (webhook and admin routes)
-- with the secret key; the table is closed to the public key entirely.

create table if not exists public.orders (
  -- Short and typeable: this is the Order Number in Pirate Ship and on the label.
  id bigint generated always as identity (start with 1001) primary key,
  -- One order per Checkout Session: a redelivered webhook inserts nothing.
  stripe_session_id text not null unique check (stripe_session_id like 'cs_%'),
  livemode boolean not null,
  created_at timestamptz not null default now(),

  customer_name text not null check (length(trim(customer_name)) > 0),
  company text,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  phone text,
  address_line1 text not null check (length(trim(address_line1)) > 0),
  address_line2 text,
  city text not null,
  state text not null,
  zip text not null,  -- text, so 02134 keeps its zero
  country text not null check (country = 'US'),

  line_items jsonb not null check (jsonb_typeof(line_items) = 'array' and jsonb_array_length(line_items) > 0),
  weight_oz integer not null check (weight_oz > 0),
  amount_paid_cents integer not null check (amount_paid_cents >= 0),
  currency text not null,

  status text not null default 'unshipped' check (status in ('unshipped', 'shipped', 'cancelled')),
  tracking_number text,
  carrier text,
  shipped_at timestamptz,
  shipping_email_sent_at timestamptz,

  constraint shipped_has_date check ((status = 'shipped') = (shipped_at is not null)),
  constraint email_only_when_tracked check (shipping_email_sent_at is null or tracking_number is not null)
);

create index if not exists orders_mode_status_idx on public.orders (livemode, status, id desc);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
