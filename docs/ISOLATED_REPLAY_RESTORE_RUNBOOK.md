# Isolated migration and restore evidence — beta gate #201

This is an **operator checklist**, not evidence of a completed rehearsal. The gate in `docs/ARISE_AUDIT.md` stays open until the full run passes. Do not use Vercel or a production database for this procedure.

## Preconditions and safety

1. Use **two disposable PostgreSQL/Supabase environments**: an empty migration target (A) and a separate empty restore target (B). Never use the active ARISE production project as either target.
2. Confirm the actual host, project reference, database name and environment owner of A and B out of band. Record redacted identifiers. Both targets must be explicitly marked disposable, and neither may share the production project reference.
3. Ensure compatible versions of PostgreSQL, Supabase extensions and the migration runner. Do not edit, squash or reorder already-applied migrations. Do not copy real customer data, tokens, service-role keys or passwords into evidence.
4. If either environment is not clearly disposable, **stop**. Do not run a migration, destructive reset, dump restore or cleanup.
5. Record the exact Git commit SHA and migration file list/checksums before starting. Run the repository's Financial Core Tests at that SHA.

## Replay in A

- Start from a clean database, using the repository's migration runner and migration order. Preserve full logs, exit codes and migration checksums.
- Inspect `finance_profiles`, `finance_categories`, `finance_goals`, `finance_transactions`, `finance_allocations`, `sync_receipts` and any other canonical schema objects required by the current migrations.
- Capture table/column types, constraints, indexes, RLS enabled/forced state, grants and policies using PostgreSQL catalog queries. A table existing is **not** proof that its ownership policy works.
- Create two synthetic auth identities and independent finance profiles. Seed representative categories, goals, reserve settings, mixed-currency income/expense transactions, allocations and mutation/receipt metadata using supported application/API paths.
- Verify owner A cannot read, update or delete owner B's records, and vice versa, under authenticated non-service-role credentials. Also check anonymous access. Service-role queries alone do not validate RLS.
- Recompute transaction-derived balances and allocations with the canonical financial engine; check exact currency-unit conservation and stable IDs.

## Backup and restore

- Take a consistent backup of **synthetic** A using the documented Supabase/PostgreSQL-compatible mechanism and preserve command exit status and tool version. For a PostgreSQL custom-format dump, a typical form is `pg_dump --format=custom --no-owner --no-acl --file=<redacted-local-path> <DISPOSABLE_A_CONNECTION>`. Do not put connection secrets into logs.
- Restore into the **empty disposable** B using the matching supported tool (for a compatible custom-format dump: `pg_restore --exit-on-error --no-owner --no-acl --dbname=<DISPOSABLE_B_CONNECTION> <redacted-local-path>`). These examples are not permission to execute against production.
- Supabase Auth identities, storage, extensions, role grants and platform-managed schemas may require platform-specific backup/restore steps; document exactly what the chosen method covers. A data-only backup cannot prove complete recovery.
- Recheck schema, RLS, policies, indexes, row counts by canonical table, cross-profile isolation, ledger-derived balances, original/base FX snapshots, stable entity IDs, mutation IDs, sync receipts and retry behavior on B.
- Run supported security/RLS advisor checks on the disposable target after restore. Record any warnings and whether they are platform configuration rather than SQL defects.

## Evidence and decision

Store only sanitized evidence: commit SHA, migration checksums, tool versions, redacted environment IDs, test command/exit status, catalog-query results, two-owner RLS matrix, row-count comparison, balance/invariant comparison, advisor results and reproducible defects.

**Pass** only if replay, restore, isolation, ledger invariants and regression tests all succeed. **Fail/blocked** if any step is missing or infrastructure is unavailable. File a focused issue/PR for each reproducible defect, rerun the relevant tests, and update `docs/ARISE_AUDIT.md` only after the *real* rehearsal passes. No simulated or documentation-only run can close #201.
