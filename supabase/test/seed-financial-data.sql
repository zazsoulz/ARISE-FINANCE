-- A third user exercises the post-migration auth bootstrap trigger.
insert into auth.users(id,email,raw_user_meta_data)
values ('33333333-3333-4333-8333-333333333333','arise-owner-c@example.invalid','{"name":"Профиль C"}'::jsonb)
on conflict (id) do nothing;

do $$
declare
  user_a constant uuid := '11111111-1111-4111-8111-111111111111';
  user_b constant uuid := '22222222-2222-4222-8222-222222222222';
  profile_a uuid;
  profile_a2 uuid;
  profile_b uuid;
  category_a uuid;
  category_a2 uuid;
  goal_a uuid;
  income_id uuid;
  income_a2 uuid;
begin
  select id into profile_a
  from public.finance_profiles
  where user_id=user_a and name='Профиль A' and archived_at is null
  limit 1;

  select id into profile_b
  from public.finance_profiles
  where user_id=user_b and name='Профиль B' and archived_at is null
  limit 1;

  if profile_a is null or profile_b is null then
    raise exception 'Backfill did not create both synthetic finance profiles';
  end if;

  insert into public.finance_profiles(user_id,name,base_currency)
  values (user_a,'Secondary profile','EUR')
  returning id into profile_a2;

  insert into public.finance_categories(
    profile_id,user_id,name,rule_type,percent,fixed_amount,priority,sort_order
  ) values (
    profile_a2,user_a,'Secondary profile category','fixed',0,250,3,10
  ) returning id into category_a2;

  insert into public.finance_categories(
    profile_id,user_id,name,rule_type,percent,fixed_amount,priority,monthly_limit,enabled,sort_order
  ) values (
    profile_a,user_a,'Replay category','fixed',0,6000,5,null,true,90
  ) returning id into category_a;

  insert into public.finance_goals(
    profile_id,user_id,name,target_amount,ledger_start,currency,priority,deadline,
    monthly_contribution,auto_allocate,status,note
  ) values (
    profile_a,user_a,'Replay goal',50000,0,'RUB',4,'2027-06-01',
    0,true,'active','Synthetic migration replay fixture'
  ) returning id into goal_a;

  insert into public.finance_transactions(
    profile_id,user_id,type,amount,currency,date,source,note,
    base_currency,exchange_rate_to_base,base_amount,fx_source,fx_fetched_at,
    client_mutation_id,payload
  ) values (
    profile_a,user_a,'income',100,'EUR','2026-11-20','Replay fixture','Synthetic EUR income',
    'RUB',100,10000,'ci-fixture',now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    jsonb_build_object('localId','replay-income','month','2026-11')
  ) returning id into income_id;

  insert into public.finance_transactions(
    profile_id,user_id,type,amount,currency,date,source,note,
    base_currency,exchange_rate_to_base,base_amount,fx_source,fx_fetched_at,
    client_mutation_id,payload
  ) values (
    profile_a,user_a,'expense',20,'USD','2026-11-20','Replay fixture','Synthetic USD expense',
    'RUB',90,1800,'ci-fixture',now(),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    jsonb_build_object('localId','replay-expense','month','2026-11')
  );

  insert into public.finance_transactions(
    profile_id,user_id,type,amount,currency,date,source,note,
    base_currency,exchange_rate_to_base,base_amount,fx_source,fx_fetched_at,
    client_mutation_id,payload
  ) values (
    profile_a2,user_a,'income',25,'EUR','2026-11-20','Secondary profile','Synthetic secondary-profile income',
    'EUR',1,25,'ci-fixture',now(),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
    jsonb_build_object('localId','secondary-profile-income','month','2026-11')
  ) returning id into income_a2;

  insert into public.finance_allocations(
    transaction_id,profile_id,user_id,allocation_type,category_id,goal_id,name_snapshot,amount,rule_snapshot
  ) values (
    income_a2,profile_a2,user_a,'unallocated',null,null,'Secondary profile free room',25,'{}'::jsonb
  );

  insert into public.finance_allocations(
    transaction_id,profile_id,user_id,allocation_type,category_id,goal_id,name_snapshot,amount,rule_snapshot
  ) values
    (income_id,profile_a,user_a,'category',category_a,null,'Replay category',6000,'{}'::jsonb),
    (income_id,profile_a,user_a,'goal',null,goal_a,'Replay goal',2000,'{}'::jsonb),
    (income_id,profile_a,user_a,'reserve',null,null,'Reserve',1000,'{}'::jsonb),
    (income_id,profile_a,user_a,'unallocated',null,null,'Unallocated',1000,'{}'::jsonb);

  update public.finance_profiles
  set settings=jsonb_set(
    coalesce(settings,'{}'::jsonb),
    '{reserve}',
    '{"enabled":true,"targetBalance":10000}'::jsonb,
    true
  )
  where id=profile_a;

  insert into public.sync_receipts(
    mutation_id,user_id,profile_id,entity_type,entity_id,operation,device_id
  ) values (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    user_a,profile_a,'transaction',income_id,'upsert','ci-device-a'
  );

  insert into storage.objects(bucket_id,name)
  values
    ('arise-avatars',user_a::text||'/avatar.png'),
    ('arise-avatars',user_b::text||'/avatar.png');
end $$;
