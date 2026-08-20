-- Phase 6: canonical Supabase performance hardening.
-- Behavior-preserving RLS init-plan optimization plus missing FK covering indexes.

create index if not exists finance_transactions_category_id_idx
  on public.finance_transactions(category_id);
create index if not exists finance_transactions_goal_id_idx
  on public.finance_transactions(goal_id);
create index if not exists finance_allocations_category_id_idx
  on public.finance_allocations(category_id);
create index if not exists finance_allocations_goal_id_idx
  on public.finance_allocations(goal_id);
create index if not exists finance_allocations_user_id_idx
  on public.finance_allocations(user_id);
create index if not exists sync_receipts_profile_id_idx
  on public.sync_receipts(profile_id);

-- Preserve exact ownership semantics while evaluating auth.uid() once per statement.
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finance_profiles_select_own on public.finance_profiles;
create policy finance_profiles_select_own on public.finance_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists finance_profiles_insert_own on public.finance_profiles;
create policy finance_profiles_insert_own on public.finance_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists finance_profiles_update_own on public.finance_profiles;
create policy finance_profiles_update_own on public.finance_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finance_profiles_delete_own on public.finance_profiles;
create policy finance_profiles_delete_own on public.finance_profiles
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists finance_categories_all_own on public.finance_categories;
create policy finance_categories_all_own on public.finance_categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finance_goals_all_own on public.finance_goals;
create policy finance_goals_all_own on public.finance_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finance_transactions_all_own on public.finance_transactions;
create policy finance_transactions_all_own on public.finance_transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finance_allocations_all_own on public.finance_allocations;
create policy finance_allocations_all_own on public.finance_allocations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists sync_receipts_all_own on public.sync_receipts;
create policy sync_receipts_all_own on public.sync_receipts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
