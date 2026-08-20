# ARISE FINANCE — Supabase beta audit (2026-08-20)

Scope: live Supabase project `Arise Finance` (`ayttgprdjhzphnwdhfsl`) compared with the current repository migrations and the beta-readiness requirements in `ARISE_AUDIT.md`.

## Verified live state

- Project is `ACTIVE_HEALTHY` on Postgres 17.6.
- Canonical finance tables use RLS: `finance_profiles`, `finance_categories`, `finance_goals`, `finance_transactions`, `finance_allocations`, and `sync_receipts` all have row-level security enabled.
- Canonical finance policies are scoped to `authenticated` and use ownership predicates based on `user_id = (select auth.uid())`.
- `finance_profiles` has explicit SELECT / INSERT / UPDATE / DELETE ownership policies; UPDATE includes both `USING` and `WITH CHECK`.
- Canonical finance entity tables use ownership checks for both visibility and writes.
- Repository migration names correspond to all seven live migration purposes: account finance profiles, secured bootstrap function, avatar storage, removal of the free-money seed, FX snapshot, goal lifecycle hardening, and canonical performance hardening.

## Security advisor result

The live security advisor reports one warning:

- **Leaked Password Protection Disabled** — compromised-password checking is not enabled in Supabase Auth.

This is a beta-release blocker for auth hardening, but it is a project Auth setting rather than an application-code defect. Enable leaked-password protection before beta sign-off and re-run the security advisor afterward.

## Performance advisor result

Canonical `finance_*` RLS policies are already using the optimized `(select auth.uid())` form. The remaining `auth_rls_initplan` warnings are on compatibility-era tables such as `profiles`, `financial_settings`, `goals`, `transactions`, `monthly_plans`, and `allocations`.

The advisor also reports missing foreign-key indexes on compatibility-era tables and several currently-unused indexes on canonical tables. Do **not** remove canonical indexes solely because they are currently unused: the project is pre-beta and low-traffic, so absence of recorded usage is not evidence that the indexes are unnecessary.

## Migration / schema observations

The live migration ledger contains seven migrations and matches the repository's seven migration intents, although the live migration version timestamps differ slightly from the filenames committed in Git. This should be treated as migration-history drift to document, not as permission to rewrite already-applied production history.

Before beta, perform a clean restore/replay rehearsal from the repository migrations into an isolated Supabase branch or disposable project and compare the resulting canonical schema with the live project.

## Remaining P0 Supabase work

1. Enable leaked-password protection in Auth and confirm the security advisor is clean or contains only explicitly accepted warnings.
2. Run the full two-device sync matrix against the live beta backend: offline edit, concurrent edit, delete-vs-edit, ambiguous failure/retry, and explicit conflict resolution.
3. Rehearse migration replay + backup/restore in an isolated environment; do not test destructive recovery procedures against the primary project.
4. Decide whether compatibility-era public tables are still needed. If they are dead, remove them only through a reviewed migration after confirming no runtime/query dependency. If they remain supported, modernize their RLS policies and missing FK indexes separately from canonical `finance_*` tables.

## Current conclusion

The canonical finance schema is materially safer than the compatibility schema and its RLS ownership model is correctly scoped. The main live security gap found by Supabase's own advisor is disabled leaked-password protection. The remaining database work is beta verification and compatibility cleanup, not a redesign of the canonical persistence model.
