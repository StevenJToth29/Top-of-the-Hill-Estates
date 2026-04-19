-- supabase/migrations/008_stripe_payout_accounts.sql

create table stripe_accounts (
  id                uuid        primary key default gen_random_uuid(),
  label             text        not null check (length(trim(label)) > 0),
  stripe_account_id text        not null unique check (stripe_account_id like 'acct_%' and length(stripe_account_id) > 5),
  created_at        timestamptz default now()
);

alter table stripe_accounts enable row level security;

create policy "Service role full access on stripe_accounts"
  on stripe_accounts
  using (auth.role() = 'service_role');

alter table properties
  add column stripe_account_id    uuid    references stripe_accounts(id) on delete set null,
  add column platform_fee_percent numeric not null default 0
    check (platform_fee_percent >= 0 and platform_fee_percent <= 100);

create index on properties (stripe_account_id);
