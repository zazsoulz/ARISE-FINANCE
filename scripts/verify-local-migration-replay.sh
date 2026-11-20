#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${ARISE_REPLAY_ARTIFACT_DIR:=/artifacts}"

case "$PGHOST" in
  127.0.0.1|localhost|::1) ;;
  *) echo "Refusing non-local PostgreSQL host: $PGHOST" >&2; exit 2 ;;
esac
if [[ "$PGDATABASE" != "arise_replay" ]]; then
  echo "Refusing database outside the dedicated arise_replay test name." >&2
  exit 2
fi

mkdir -p "$ARISE_REPLAY_ARTIFACT_DIR"
RESTORE_DB="arise_replay_restore"
DUMP_FILE="$ARISE_REPLAY_ARTIFACT_DIR/arise-replay.dump"
SUMMARY_FILE="$ARISE_REPLAY_ARTIFACT_DIR/arise-local-migration-replay-summary.txt"
PSQL_ARGS=(-X --set ON_ERROR_STOP=1 --host "$PGHOST" --port "$PGPORT" --username "$PGUSER")

run_sql() {
  local database="$1"
  shift
  psql "${PSQL_ARGS[@]}" --dbname "$database" "$@"
}

query_scalar() {
  local database="$1"
  local query="$2"
  run_sql "$database" --tuples-only --no-align --command "$query" | tr -d '[:space:]'
}

run_sql "$PGDATABASE" --file /repo/supabase/test/bootstrap.sql
run_sql "$PGDATABASE" --file /repo/schema.sql
run_sql "$PGDATABASE" --file /repo/supabase/test/seed-users.sql

migration_files=(/repo/supabase/migrations/*.sql)
if (("${#migration_files[@]}" == 0)); then
  echo "No SQL migrations found for replay." >&2
  exit 3
fi
for migration in "${migration_files[@]}"; do
  echo "Applying $(basename "$migration")"
  run_sql "$PGDATABASE" --file "$migration"
done

run_sql "$PGDATABASE" --file /repo/supabase/test/seed-financial-data.sql
run_sql "$PGDATABASE" --file /repo/supabase/test/assertions.sql
run_sql "$PGDATABASE" --file /repo/supabase/test/rls-assertions.sql

pg_dump --format=custom --no-owner --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$PGDATABASE" --file "$DUMP_FILE"
dropdb --if-exists --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$RESTORE_DB"
createdb --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$RESTORE_DB"
pg_restore --exit-on-error --no-owner --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$RESTORE_DB" "$DUMP_FILE"

run_sql "$RESTORE_DB" --file /repo/supabase/test/assertions.sql
run_sql "$RESTORE_DB" --file /repo/supabase/test/rls-assertions.sql"

RESTORED_NET=$(query_scalar "$RESTORE_DB" "select coalesce(sum(case when type='income' then base_amount when type='expense' then -base_amount else 0 end),0)::text from public.finance_transactions where user_id='11111111-1111-4111-8111-111111111111'::uuid")
RESTORED_ALLOCATION_TOTAL=$(query_scalar "$RESTORE_DB" "select coalesce(sum(a.amount),0)::text from public.finance_allocations a join public.finance_transactions t on t.id=a.transaction_id where t.client_mutation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid")
RESTORED_TRANSACTIONS=$(query_scalar "$RESTORE_DB" "select count(*)::text from public.finance_transactions where user_id='11111111-1111-4111-8111-111111111111'::uuid")
RESTORED_RECEIPTS=$(query_scalar "$RESTORE_DB" "select count(*)::text from public.sync_receipts where mutation_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid")

{
  printf 'format=arise-local-migration-replay-v1\n'
  printf 'postgres_version='
  run_sql "$RESTORE_DB" --tuples-only --no-align --command 'show server_version'
  printf 'baseline_sha256=%s\n' "$(sha256sum /repo/schema.sql | awk '{print $1}')"
  for migration in "${migration_files[@]}"; do
    printf 'migration=%s sha256=%s\n' "$(basename "$migration")" "$(sha256sum "$migration" | awk '{print $1}')"
  done
  printf 'source_replay=passed\n'
  printf 'two_owner_rls=passed\n'
  printf 'backup_restore=passed\n'
  printf 'restored_ledger_net_rub=%s\n' "$RESTORED_NET"
  printf 'restored_income_allocation_total=%s\n' "$RESTORED_ALLOCATION_TOTAL"
  printf 'restored_owner_a_transaction_count=%s\n' "$RESTORED_TRANSACTIONS"
  printf 'restored_sync_receipt_count=%s\n' "$RESTORED_RECEIPTS"
  printf 'backup_sha256=%s\n' "$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
  printf 'backup_bytes=%s\n' "$(wc -c < "$DUMP_FILE" | tr -d ' ')"
} > "$SUMMARY_FILE"

rm -f "$DUMP_FILE"
echo "Local PostgreSQL migration replay and restore passed. Summary: $SUMMARY_FILE"
