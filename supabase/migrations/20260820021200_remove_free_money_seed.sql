-- Keep unallocated money as a ledger state, never as a system category.

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
      (fp_id,new.id,'Семья','percentage',15,0,4,20);
  end if;

  return new;
end;
$$;

revoke all on function public.bootstrap_arise_user() from public, anon, authenticated;

-- Remove only untouched seed rows; user-created or already-used rows are preserved.
delete from public.finance_categories c
where c.name='Свободные деньги'
  and c.rule_type='percentage'
  and c.percent=20
  and c.priority=3
  and not exists (select 1 from public.finance_transactions t where t.category_id=c.id)
  and not exists (select 1 from public.finance_allocations a where a.category_id=c.id);
