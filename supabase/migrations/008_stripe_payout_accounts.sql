-- supabase/migrations/008_stripe_payout_accounts.sql

create table stripe_accounts (
  id                uuid        primary key default gen_random_uuid(),
  label             text        not null,
  stripe_account_id text        not null unique,
  created_at        timestamptz default now()
);

alter table properties
  add column stripe_account_id    uuid    references stripe_accounts(id) on delete set null,
  add column platform_fee_percent numeric default 0
    check (platform_fee_percent >= 0 and platform_fee_percent <= 100);
