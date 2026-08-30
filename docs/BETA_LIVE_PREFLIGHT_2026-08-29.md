# ARISE FINANCE — Live Beta Preflight (2026-08-29)

Scope: read-only verification against the connected Supabase project `Arise Finance` while active development remains GitHub/standalone-first. No Vercel deployment or preview was used.

## Repository baseline

- `main`: `ce097eb0cf8c38440791ae5497a7b32f60362cee`
- Latest `Financial Core Tests` workflow on that commit: PASS.
- The previous draft home-flow PR `#173` is intentionally not part of beta verification; it was superseded by the newer unified-particle-matter visual requirement and must not be merged.

## Live canonical schema / RLS

Verified live tables:

- `finance_profiles`
- `finance_categories`
- `finance_goals`
- `finance_transactions`
- `finance_allocations`
- `sync_receipts`

All six canonical tables currently have row-level security enabled.

Canonical ownership policies use authenticated-user ownership checks based on `user_id = (select auth.uid())`. This confirms the canonical tables are using the optimized single-evaluation form rather than per-row `auth.uid()` calls.

This is a read-only structural check. It does not replace the two-account cross-ownership rehearsal required by `docs/BETA_SIGNOFF_PLAYBOOK.md`.

## Security advisor

Current blocker:

- `Leaked Password Protection Disabled` — WARN.

This remains a beta P0. Before beta sign-off, enable compromised/leaked-password protection in Supabase Auth and re-run the Security Advisor. The warning must disappear before the beta gate can pass.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Performance advisor

The connected project still contains compatibility-era tables (`profiles`, `financial_settings`, `goals`, `transactions`, `monthly_plans`, `allocations`) with advisor warnings such as unindexed foreign keys and legacy RLS initialization-plan findings.

Do **not** optimize or drop those compatibility tables merely to clear advisor noise. `docs/ARISE_AUDIT.md` already requires migration replay / backup-restore proof before compatibility-era storage is physically retired.

Canonical `finance_*` ownership policies inspected in this run already use `(select auth.uid())`, so the legacy advisor warnings are not evidence that the canonical runtime RLS path regressed.

## Beta status after this preflight

Still required before beta-ready:

1. Real two-device sync matrix against the beta environment.
2. Isolated migration replay on a disposable environment.
3. Backup/restore rehearsal on a disposable environment.
4. Enable leaked-password protection and re-run security/auth checks.
5. Standalone mobile/desktop verification of the canonical manifest, including final dead-primary-action and accessibility pass.

Vercel remains outside the active correctness loop until these gates are complete or an explicit deployment is requested.
