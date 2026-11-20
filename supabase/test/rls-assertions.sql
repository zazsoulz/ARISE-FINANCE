-- Exercise the actual policies with two authenticated owner claims.

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
declare
  visible_count integer;
  affected_rows integer;
begin
  select count(*) into visible_count from public.finance_profiles;
  if visible_count <> 1 then raise exception 'Owner A should see exactly one finance profile'; end if;
  select count(*) into visible_count from public.finance_transactions;
  if visible_count <> 2 then raise exception 'Owner A should see exactly two ledger rows'; end if;
  select count(*) into visible_count from public.finance_transactions
    where user_id='22222222-2222-4222-8222-222222222222'::uuid;
  if visible_count <> 0 then raise exception 'Owner A can see owner B ledger rows'; end if;
  select count(*) into visible_count from storage.objects;
  if visible_count <> 1 then raise exception 'Owner A should see only their private avatar object'; end if;

  update public.finance_transactions
    set note='forbidden cross-owner update'
    where user_id='22222222-2222-4222-8222-222222222222'::uuid;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'Owner A updated owner B ledger rows'; end if;

  delete from public.finance_transactions
    where user_id='22222222-2222-4222-8222-222222222222'::uuid;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'Owner A deleted owner B ledger rows'; end if;

  begin
    insert into public.finance_profiles(user_id,name,base_currency)
    values('22222222-2222-4222-8222-222222222222'::uuid,'Forbidden cross-owner profile','RUB');
    raise exception 'ARISE_TEST_EXPECTED_RLS_DENIAL_NOT_RAISED';
  exception when insufficient_privilege then
    null;
  end;
end $$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.finance_profiles;
  if visible_count <> 1 then raise exception 'Owner B should see exactly one finance profile'; end if;
  select count(*) into visible_count from public.finance_transactions;
  if visible_count <> 0 then raise exception 'Owner B must not see owner A ledger rows'; end if;
  select count(*) into visible_count from storage.objects;
  if visible_count <> 1 then raise exception 'Owner B should see only their private avatar object'; end if;
end $$;
rollback;
