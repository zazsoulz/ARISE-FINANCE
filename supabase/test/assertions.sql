-- Assertions run as the database owner against source and restored databases.
do $$
declare
  user_a constant uuid := '11111111-1111-4111-8111-111111111111';
  user_b constant uuid := '22222222-2222-4222-8222-222222222222';
  user_c constant uuid := '33333333-3333-4333-8333-333333333333';
  profile_a uuid;
  profile_a2 uuid;
  income_id uuid;
  income_a2 uuid;
  net_base numeric;
  net_secondary numeric;
  allocated numeric;
  allocated_secondary numeric;
begin
  if (select count(*) from public.accounts where user_id in (user_a,user_b,user_c)) <> 3 then
    raise exception 'Expected three account rows after backfill and auth bootstrap';
  end if;

  if (select count(*) from public.finance_profiles where user_id=user_a and archived_at is null) <> 2
     or (select count(*) from public.finance_profiles where user_id=user_b and archived_at is null) <> 1
     or (select count(*) from public.finance_profiles where user_id=user_c and archived_at is null) <> 1 then
    raise exception 'Expected two independent active profiles for owner A and one for owners B/C';
  end if;

  select id into profile_a from public.finance_profiles
    where user_id=user_a and name='Профиль A' and archived_at is null;
  select id into profile_a2 from public.finance_profiles
    where user_id=user_a and name='Secondary profile' and archived_at is null;
  select id into income_id from public.finance_transactions
    where profile_id=profile_a and client_mutation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  select id into income_a2 from public.finance_transactions
    where profile_id=profile_a2 and client_mutation_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid;

  if profile_a is null or profile_a2 is null or profile_a=profile_a2 or income_id is null or income_a2 is null then
    raise exception 'Independent profile IDs or stable transaction identifiers were not preserved';
  end if;
  if (select base_currency from public.finance_profiles where id=profile_a2) <> 'EUR' then
    raise exception 'Secondary financial profile base currency was not preserved';
  end if;

  if (select count(*) from public.finance_categories where profile_id=profile_a) <> 3 then
    raise exception 'Expected two bootstrap categories plus the synthetic category';
  end if;
  if (select count(*) from public.finance_categories where user_id=user_c) <> 2 then
    raise exception 'New-user bootstrap must create only the two canonical starter categories';
  end if;
  if not exists (
    select 1 from public.finance_profiles
    where user_id=user_c
      and settings #>> '{reserve,enabled}'='false'
      and settings #>> '{monthStartDay}'='1'
  ) then
    raise exception 'New-user finance profile defaults differ from the canonical migration defaults';
  end if;
  if (select count(*) from public.finance_goals where profile_id=profile_a) <> 1 then
    raise exception 'Synthetic goal row is missing';
  end if;
  if (select count(*) from public.finance_transactions where profile_id=profile_a) <> 2 then
    raise exception 'Synthetic mixed-currency ledger rows are missing';
  end if;
  if (select count(*) from public.finance_categories where profile_id=profile_a2) <> 1
     or (select count(*) from public.finance_goals where profile_id=profile_a2) <> 0
     or (select count(*) from public.finance_transactions where profile_id=profile_a2) <> 1 then
    raise exception 'Secondary profile data leaked from or into the primary profile';
  end if;
  if not exists (
    select 1 from public.finance_profiles
    where id=profile_a2
      and settings #>> '{reserve,enabled}'='false'
      and settings #>> '{monthStartDay}'='1'
  ) then
    raise exception 'Secondary profile defaults differ from the canonical migration defaults';
  end if;
  if (select count(*) from public.finance_allocations where transaction_id=income_id) <> 4 then
    raise exception 'Expected category, goal, reserve and unallocated income allocations';
  end if;

  select coalesce(sum(case when type='income' then base_amount when type='expense' then -base_amount else 0 end),0)
  into net_base
  from public.finance_transactions
  where profile_id=profile_a;
  if net_base <> 8200 then
    raise exception 'Ledger-derived base-currency net mismatch: %',net_base;
  end if;

  select coalesce(sum(amount),0) into allocated
  from public.finance_allocations
  where transaction_id=income_id;
  if allocated <> 10000 then
    raise exception 'Income allocation conservation mismatch: %',allocated;
  end if;
  select coalesce(sum(base_amount),0) into net_secondary
  from public.finance_transactions where profile_id=profile_a2;
  if net_secondary <> 25 then
    raise exception 'Secondary profile EUR ledger mismatch: %',net_secondary;
  end if;
  select coalesce(sum(amount),0) into allocated_secondary
  from public.finance_allocations where transaction_id=income_a2;
  if allocated_secondary <> 25 then
    raise exception 'Secondary profile allocation conservation mismatch: %',allocated_secondary;
  end if;
  if (select count(*) from public.finance_transactions where user_id=user_a) <> 3 then
    raise exception 'Expected three transactions across the two independent owner-A profiles';
  end if;

  if (select count(*) from public.sync_receipts
      where mutation_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
        and entity_id=income_id and user_id=user_a) <> 1 then
    raise exception 'Sync receipt or mutation identifier was not preserved';
  end if;

  if not exists (
    select 1 from public.finance_profiles
    where id=profile_a and settings #>> '{reserve,enabled}'='true'
      and updated_at is not null
  ) then
    raise exception 'Reserve settings or profile updated_at was not preserved';
  end if;

  if (select relrowsecurity from pg_class where oid='public.finance_profiles'::regclass) is distinct from true
     or (select relrowsecurity from pg_class where oid='public.finance_transactions'::regclass) is distinct from true
     or (select relrowsecurity from pg_class where oid='public.finance_allocations'::regclass) is distinct from true
     or (select relrowsecurity from pg_class where oid='public.sync_receipts'::regclass) is distinct from true
     or (select relrowsecurity from pg_class where oid='storage.objects'::regclass) is distinct from true then
    raise exception 'RLS is not enabled on every canonical or avatar table';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finance_transactions' and policyname='finance_transactions_all_own')
     or not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='arise_avatar_select_own') then
    raise exception 'Expected canonical finance and private avatar policies are missing';
  end if;

  if has_table_privilege('anon','public.finance_profiles','SELECT') then
    raise exception 'Anonymous role unexpectedly has access to finance_profiles';
  end if;

  if (select public from storage.buckets where id='arise-avatars') is distinct from false then
    raise exception 'Avatar bucket must remain private';
  end if;
end $$;
