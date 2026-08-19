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

-- Ownership guards.
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

-- updated_at triggers.
drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
drop trigger if exists finance_profiles_set_updated_at on public.finance_profiles;
create trigger finance_profiles_set_updated_at before update on public.finance_profiles
for each row execute function public.set_updated_at();
drop trigger if exists finance_categories_set_updated_at on public.finance_categories;
create trigger finance_categories_set_updated_at before update on public.finance_categories
for each row execute function public.set_updated_at();
drop trigger if exists finance_goals_set_updated_at on public.finance_goals;
create trigger finance_goals_set_updated_at before update on public.finance_goals
for each row execute function public.set_updated_at();
drop trigger if exists finance_transactions_set_updated_at on public.finance_transactions;
create trigger finance_transactions_set_updated_at before update on public.finance_transactions
for each row execute function public.set_updated_at();

-- New auth user bootstrap. Account information remains separate from finance profiles.
create or replace function public.bootstrap_arise_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  fp_id uuid;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1), '');

  insert into public.accounts(user_id,name,avatar_url)
  values(new.id,display_name,coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture'))
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.finance_profiles where user_id=new.id and archived_at is null) then
    insert into public.finance_profiles(user_id,name,base_currency)
    values(new.id,'Основной','RUB')
    returning id into fp_id;

    insert into public.finance_categories(profile_id,user_id,name,rule_type,percent,fixed_amount,priority,sort_order)
    values
      (fp_id,new.id,'Обязательные расходы','fixed',0,0,5,10),
      (fp_id,new.id,'Семья','percentage',15,0,4,20),
      (fp_id,new.id,'Свободные деньги','percentage',20,0,3,30);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_arise on auth.users;
create trigger on_auth_user_created_arise
after insert on auth.users
for each row execute function public.bootstrap_arise_user();

-- Backfill existing auth users without touching legacy finance data.
insert into public.accounts(user_id,name,avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'full_name',p.name,split_part(coalesce(u.email,''),'@',1),''),
  coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture')
from auth.users u
left join public.profiles p on p.id=u.id
on conflict (user_id) do nothing;

do $$
declare
  r record;
  fp_id uuid;
begin
  for r in
    select u.id as user_id, coalesce(p.name,'Основной') as profile_name, coalesce(p.base_currency,'RUB') as base_currency
    from auth.users u
    left join public.profiles p on p.id=u.id
    where not exists (select 1 from public.finance_profiles fp where fp.user_id=u.id and fp.archived_at is null)
  loop
    insert into public.finance_profiles(user_id,name,base_currency)
    values(r.user_id,r.profile_name,case when r.base_currency in ('RUB','USD','EUR') then r.base_currency else 'RUB' end)
    returning id into fp_id;

    insert into public.finance_categories(profile_id,user_id,name,rule_type,percent,fixed_amount,priority,sort_order)
    values
      (fp_id,r.user_id,'Обязательные расходы','fixed',0,0,5,10),
      (fp_id,r.user_id,'Семья','percentage',15,0,4,20),
      (fp_id,r.user_id,'Свободные деньги','percentage',20,0,3,30);
  end loop;
end $$;

-- RLS: every account/profile/financial row belongs to the authenticated auth.uid().
alter table public.accounts enable row level security;
alter table public.finance_profiles enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_goals enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_allocations enable row level security;
alter table public.sync_receipts enable row level security;

-- Account policies.
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts for select to authenticated using (user_id=auth.uid());
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Profile policies.
drop policy if exists finance_profiles_select_own on public.finance_profiles;
create policy finance_profiles_select_own on public.finance_profiles for select to authenticated using (user_id=auth.uid());
drop policy if exists finance_profiles_insert_own on public.finance_profiles;
create policy finance_profiles_insert_own on public.finance_profiles for insert to authenticated with check (user_id=auth.uid());
drop policy if exists finance_profiles_update_own on public.finance_profiles;
create policy finance_profiles_update_own on public.finance_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists finance_profiles_delete_own on public.finance_profiles;
create policy finance_profiles_delete_own on public.finance_profiles for delete to authenticated using (user_id=auth.uid());

-- Reusable direct user_id ownership policies for profile-scoped tables.
drop policy if exists finance_categories_all_own on public.finance_categories;
create policy finance_categories_all_own on public.finance_categories for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists finance_goals_all_own on public.finance_goals;
create policy finance_goals_all_own on public.finance_goals for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists finance_transactions_all_own on public.finance_transactions;
create policy finance_transactions_all_own on public.finance_transactions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists finance_allocations_all_own on public.finance_allocations;
create policy finance_allocations_all_own on public.finance_allocations for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists sync_receipts_all_own on public.sync_receipts;
create policy sync_receipts_all_own on public.sync_receipts for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

revoke all on table public.accounts,public.finance_profiles,public.finance_categories,public.finance_goals,public.finance_transactions,public.finance_allocations,public.sync_receipts from anon;
grant select,insert,update,delete on table public.accounts,public.finance_profiles,public.finance_categories,public.finance_goals,public.finance_transactions,public.finance_allocations,public.sync_receipts to authenticated;
