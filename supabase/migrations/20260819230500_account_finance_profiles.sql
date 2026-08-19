-- ARISE canonical account/profile ledger schema.
-- Additive migration: legacy public tables remain untouched during transition.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Основной',
  base_currency text not null default 'RUB' check (base_currency in ('RUB','USD','EUR')),
  settings jsonb not null default '{"reserve":{"enabled":false,"percent":0,"priority":3,"limit":null,"target":null},"monthStartDay":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists finance_profiles_user_id_idx on public.finance_profiles(user_id);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rule_type text not null default 'percentage' check (rule_type in ('fixed','percentage')),
  percent integer not null default 0 check (percent between 0 and 100),
  fixed_amount numeric(20,4) not null default 0 check (fixed_amount >= 0),
  priority integer not null default 3 check (priority between 1 and 5),
  monthly_limit numeric(20,4) check (monthly_limit is null or monthly_limit >= 0),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_categories_profile_id_idx on public.finance_categories(profile_id);
create index if not exists finance_categories_user_id_idx on public.finance_categories(user_id);

create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(20,4) not null check (target_amount >= 0),
  ledger_start numeric(20,4) not null default 0 check (ledger_start >= 0),
  currency text not null default 'RUB' check (currency in ('RUB','USD','EUR')),
  priority integer not null default 3 check (priority between 1 and 5),
  deadline date,
  monthly_contribution numeric(20,4) not null default 0 check (monthly_contribution >= 0),
  auto_allocate boolean not null default true,
  status text not null default 'active' check (status in ('active','completed','archived')),
  note text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_goals_profile_id_idx on public.finance_goals(profile_id);
create index if not exists finance_goals_user_id_idx on public.finance_goals(user_id);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','goal_contribution','goal_withdrawal','reserve_deposit','reserve_withdrawal','transfer')),
  amount numeric(20,4) not null default 0 check (amount >= 0),
  currency text not null default 'RUB' check (currency in ('RUB','USD','EUR')),
  date date not null default current_date,
  source text not null default '',
  note text not null default '',
  category_id uuid references public.finance_categories(id) on delete set null,
  goal_id uuid references public.finance_goals(id) on delete set null,
  funding_source text,
  controlled_amount numeric(20,4) not null default 0 check (controlled_amount >= 0),
  uncontrolled_amount numeric(20,4) not null default 0 check (uncontrolled_amount >= 0),
  remainder numeric(20,4) not null default 0 check (remainder >= 0),
  reserve_amount numeric(20,4) not null default 0 check (reserve_amount >= 0),
  payload jsonb not null default '{}'::jsonb,
  client_mutation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists finance_transactions_user_mutation_uidx
  on public.finance_transactions(user_id,client_mutation_id)
  where client_mutation_id is not null;
create index if not exists finance_transactions_profile_date_idx on public.finance_transactions(profile_id,date desc);
create index if not exists finance_transactions_user_id_idx on public.finance_transactions(user_id);

create table if not exists public.finance_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
  profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_type text not null check (allocation_type in ('category','goal','reserve','unallocated')),
  category_id uuid references public.finance_categories(id) on delete set null,
  goal_id uuid references public.finance_goals(id) on delete set null,
  name_snapshot text not null default '',
  amount numeric(20,4) not null default 0 check (amount >= 0),
  rule_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_allocations_transaction_id_idx on public.finance_allocations(transaction_id);
create index if not exists finance_allocations_profile_id_idx on public.finance_allocations(profile_id);

create table if not exists public.sync_receipts (
  mutation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.finance_profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  operation text not null,
  device_id text,
  received_at timestamptz not null default now()
);

create index if not exists sync_receipts_user_id_idx on public.sync_receipts(user_id);

-- Prevent clients from writing another user's id into profile-scoped rows.
create or replace function public.assert_finance_profile_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.finance_profiles fp
    where fp.id = new.profile_id and fp.user_id = new.user_id
  ) then
    raise exception 'finance profile owner mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_categories_owner_guard on public.finance_categories;
create trigger finance_categories_owner_guard before insert or update on public.finance_categories
for each row execute function public.assert_finance_profile_owner();

drop trigger if exists finance_goals_owner_guard on public.finance_goals;
create trigger finance_goals_owner_guard before insert or update on public.finance_goals
for each row execute function public.assert_finance_profile_owner();

drop trigger if exists finance_transactions_owner_guard on public.finance_transactions;
create trigger finance_transactions_owner_guard before insert or update on public.finance_transactions
for each row execute function public.assert_finance_profile_owner();

drop trigger if exists finance_allocations_owner_guard on public.finance_allocations;
create trigger finance_allocations_owner_guard before insert or update on public.finance_allocations
for each row execute function public.assert_finance_profile_owner();

-- updated_at triggers
foreach_dummy: begin end;
