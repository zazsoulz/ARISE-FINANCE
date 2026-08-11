-- ARISE FINANCE production schema for Supabase
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Мой профиль',
  created_at timestamptz not null default now()
);

create table if not exists public.finance_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'RUB',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  finance_profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  name text not null,
  goal_type text not null default 'goal',
  target numeric not null default 0,
  current numeric not null default 0,
  currency text not null default 'RUB',
  deadline date,
  priority integer not null default 3 check(priority between 1 and 5),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  finance_profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  type text not null check(type in ('income','expense')),
  amount numeric not null,
  currency text not null default 'RUB',
  transaction_date date not null,
  source text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  finance_profile_id uuid not null references public.finance_profiles(id) on delete cascade,
  income_id uuid references public.transactions(id) on delete set null,
  amount numeric not null default 0,
  allocation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  primary key(base_currency, quote_currency)
);

alter table public.profiles enable row level security;
alter table public.finance_profiles enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;
alter table public.allocations enable row level security;
alter table public.exchange_rates enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own finance profiles" on public.finance_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own goals" on public.goals for all using (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
) with check (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
);

create policy "own transactions" on public.transactions for all using (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
) with check (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
);

create policy "own allocations" on public.allocations for all using (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
) with check (
  exists(select 1 from public.finance_profiles p where p.id=finance_profile_id and p.user_id=auth.uid())
);

create policy "public exchange rates read" on public.exchange_rates for select using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, display_name) values(new.id, coalesce(new.raw_user_meta_data->>'name','Мой профиль'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
