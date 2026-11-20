#!/usr/bin/env bash
set -euo pipefail

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

run_sql "$PGDATABASE" --file /repo/supabase/test/bootstrap.sql
run_sql "$PGDATABASE" --file /repo/schema.sql
run_sql "$PGDATABASE" --file /repo/supabase/test/seed-users.sql

for migration in /repo/supabase/migrations/*.sql; do
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
run_sql "$RESTORE_DB" --file /repo/supabase/test/rls-assertions.sql

{
  printf 'format=arise-local-migration-replay-v1\n'
  printf 'postgres_version='
  run_sql "$RESTORE_DB" --tuples-only --no-align --command 'show server_version'
  printf 'baseline_sha256=%s\n' "$(sha256sum /repo/schema.sql | awk '{print $1}')"
  for migration in /repo/supabase/migrations/*.sql; do
    printf 'migration=%s sha256=%s\n' "$(basename "$migration")" "$(sha256sum "$migration" | awk '{print $1}')"
  done
  printf 'source_replay=passed\n'
  printf 'two_owner_rls=passed\n'
  printf 'backup_restore=passed\n'
  printf 'restored_ledger_net_rub=8200\n'
  printf 'restored_income_allocation_total=10000\n'
  printf 'backup_sha256=%s\n' "$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
  printf 'backup_bytes=%s\n' "$(wc -c < "$DUMP_FILE" | tr -d ' ')"
} > "$SUMMARY_FILE"

rm -f "$DUMP_FILE"
echo "Local PostgreSQL migration replay and restore passed. Summary: $SUMMARY_FILE"
