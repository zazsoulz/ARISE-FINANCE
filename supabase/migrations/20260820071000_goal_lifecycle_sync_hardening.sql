-- Phase 6: persist canonical goal closure lifecycle across devices.

alter table public.finance_goals
  drop constraint if exists finance_goals_status_check;

alter table public.finance_goals
  add constraint finance_goals_status_check
  check (status in ('active','completed','archived','closed'));

alter table public.finance_goals
  add column if not exists closed_at timestamptz,
  add column if not exists closure_balance numeric(20,4) check (closure_balance is null or closure_balance >= 0),
  add column if not exists closure_destination text;

comment on column public.finance_goals.closed_at is
  'Date/time when a goal was intentionally closed after its remaining balance was reconciled.';
comment on column public.finance_goals.closure_balance is
  'Ledger balance routed away from the goal at closure time.';
comment on column public.finance_goals.closure_destination is
  'Canonical local destination: free, reserve, or goal:<local/remote identifier snapshot>.';
