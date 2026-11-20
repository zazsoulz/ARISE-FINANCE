-- Assertions run as the database owner against source and restored databases.
do $$
declare
  user_a constant uuid := '11111111-1111-4111-8111-111111111111';
  user_b constant uuid := '22222222-2222-4222-8222-222222222222';
  user_c constant uuid := '33333333-3333-4333-8333-333333333333';
  profile_a uuid;
  income_id uuid;
  net_base numeric;
  allocated numeric;
begin
  if (select count(*) from public.accounts where user_id in (user_a,user_b,user_c)) <> 3 then
    raise exception 'Expected three account rows after backfill and auth bootstrap';
  end if;

  if (select count(*) from public.finance_profiles where user_id=user_a and archived_at is null) <> 1
     or (select count(*) from public.finance_profiles where user_id=user_b and archived_at is null) <> 1
     or (select count(*) from public.finance_profiles where user_id=user_c and archived_at is null) <> 1 then
    raise exception 'Expected one isolated active finance profile per synthetic owner';
  end if;

  select id into profile_a from public.finance_profiles where user_id=user_a and archived_at is null;
  select id into income_id from public.finance_transactions
    where profile_id=profile_a and client_mutation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;

  if profile_a is null or income_id is null then
    raise exception 'Canonical profile or stable income transaction identifier was not preserved';
  end if;

  if (select count(*) from public.finance_categories where profile_id=profile_a) <> 3 then
    raise exception 'Expected two bootstrap categories plus the synthetic category';
  end if;
  if (select count(*) from public.finance_categories where user_id=user_c) <> 2 then
    raise exception 'New-user bootstrap must create only the two canonical starter categories';
  end if;
  if (select count(*) from public.finance_goals where profile_id=profile_a) <> 1 then
    raise exception 'Synthetic goal row is missing';
  end if;
  if (select count(*) from public.finance_transactions where profile_id=profile_a) <> 2 then
    raise exception 'Synthetic mixed-currency ledger rows are missing';
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
