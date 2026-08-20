alter table public.finance_transactions
  add column if not exists base_currency text,
  add column if not exists exchange_rate_to_base numeric,
  add column if not exists base_amount numeric,
  add column if not exists fx_source text,
  add column if not exists fx_fetched_at timestamptz;

alter table public.finance_transactions
  drop constraint if exists finance_transactions_currency_check;
alter table public.finance_transactions
  add constraint finance_transactions_currency_check
  check (currency in ('RUB','EUR','USD'));

alter table public.finance_transactions
  drop constraint if exists finance_transactions_base_currency_check;
alter table public.finance_transactions
  add constraint finance_transactions_base_currency_check
  check (base_currency is null or base_currency in ('RUB','EUR','USD'));

alter table public.finance_transactions
  drop constraint if exists finance_transactions_exchange_rate_positive_check;
alter table public.finance_transactions
  add constraint finance_transactions_exchange_rate_positive_check
  check (exchange_rate_to_base is null or exchange_rate_to_base > 0);

alter table public.finance_transactions
  drop constraint if exists finance_transactions_base_amount_nonnegative_check;
alter table public.finance_transactions
  add constraint finance_transactions_base_amount_nonnegative_check
  check (base_amount is null or base_amount >= 0);

comment on column public.finance_transactions.amount is 'Original transaction amount in currency.';
comment on column public.finance_transactions.currency is 'Original transaction currency; never rewritten by later FX changes.';
comment on column public.finance_transactions.base_currency is 'Financial profile base currency at transaction conversion time.';
comment on column public.finance_transactions.exchange_rate_to_base is 'Snapshot multiplier: original amount * rate = base_amount.';
comment on column public.finance_transactions.base_amount is 'Transaction amount normalized to base_currency using the stored snapshot rate.';
comment on column public.finance_transactions.fx_source is 'Source identifier for the exchange-rate snapshot.';
comment on column public.finance_transactions.fx_fetched_at is 'Timestamp of the rate snapshot used for conversion.';

create index if not exists finance_transactions_profile_base_currency_idx
  on public.finance_transactions(profile_id, base_currency, date)
  where deleted_at is null;
