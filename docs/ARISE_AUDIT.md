# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `1ae866b6cc70d1e2b0019cbe53259e17a133d6a9` (2026-08-20).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE is beyond foundational ledger/auth/sync work. `main` contains a ledger-backed financial core, account auth, isolated financial profiles, Supabase persistence, local-first mutation outboxes, conflict detection and explicit local-vs-server resolution UI, mixed-currency support, transaction-derived history/analytics, funded-goal lifecycle protection, completed-goal future-funds rerouting, explicit create/edit expense reconciliation, transaction-backed reserve lifecycle, consequence previews for manual income-plan edits, onboarding templates, completed-goal lifecycle analytics, stale-FX disclosure, explicit essential-expense reserve runway inputs, and the A1-V3 product shell.

The previous lifecycle-correctness and compatibility-delete P0 backlog is closed. The highest-value remaining work is real beta-environment verification, operational Supabase hardening, compatibility-shell consolidation and final product polish. Vercel remains intentionally outside the active development loop; GitHub Actions, branch/PR review and standalone/local artifacts remain the verification path until stable beta.

## Financial core
- ✅ One effective financial calculation source of truth is used at runtime.
- ✅ Startup fails closed if the canonical financial runtime is missing or the compatibility financial engine was not stripped.
- ✅ Exact currency-unit conservation is regression-tested.
- ✅ System unallocated remainder is separate from user categories and names.
- ✅ Category priority, monthly limits, reserve and goals materially participate in allocation.
- ✅ Goal and reserve balances are transaction-derived.
- ✅ Explicit controlled/uncontrolled expense accounting is implemented for create and edit flows.
- ✅ Multi-profile isolation has regression coverage.
- 🟡 Historical compatibility layers still surround the canonical runtime and should be physically consolidated before release.

## Categories
- ✅ User-defined categories are editable/deletable and have no magic names.
- ✅ Fixed and integer-percentage rules, priority, enabled state and monthly limits are implemented.
- ✅ Category sync uses persistent mutation queues and conflict protection.
- ✅ Legacy category tombstones are migrated one-way into the unified entity outbox; no direct compatibility delete write-path remains.
- ✅ New-profile onboarding offers explicit starter templates instead of silently imposing one canonical budget.
- 🟡 Category settings still need a final visual/usability pass and clearer consequence language around priority/limit changes.

## Reserve
- ✅ Reserve is separate from categories and ledger-backed.
- ✅ Contribution settings, target/progress and deterministic runway analytics exist.
- ✅ Reserve deposits and withdrawals are transaction-backed.
- ✅ Reserve-to-goal funding preserves money conservation and transfer semantics through sync.
- ✅ Reserve lifecycle UI exposes deposit/withdrawal/history-oriented actions without mutating a standalone balance counter.
- ✅ Runway uses an explicit user-controlled model: manual monthly essential spend or explicitly selected essential categories; ARISE no longer silently treats all spending as essential.
- 🟡 Reserve lifecycle analytics can still receive richer transaction drill-down and completion-state polish.

## Goals
- ✅ Goals participate in automatic allocation by priority/deadline/pace.
- ✅ Goal balances and contributions are transaction-derived.
- ✅ Completed goals stop receiving automatic allocations.
- ✅ Funded goals cannot be destructively deleted.
- ✅ Closing a funded goal requires a typed destination and preserves value/history; destinations include unallocated funds, reserve, or another eligible goal.
- ✅ Goal closure metadata is persisted/synced (`closed_at`, `closure_balance`, `closure_destination`).
- ✅ Closed goals remain visible as historical lifecycle entities.
- ✅ Completed-goal future-funds rerouting is persisted and applied by the canonical allocation engine rather than a second planner.
- ✅ Completed-goal analytics derive duration, original-vs-actual forecast delta, contribution totals and average pace from ledger-backed history.
- 🟡 Completion method / future-reroute presentation can still receive final UX polish.

## Income and allocation
- ✅ Every income is an individual stable-ID transaction.
- ✅ Any number of incomes per month is supported.
- ✅ Proposal-before-save and manual editing exist.
- ✅ Positive unallocated remainder is valid.
- ✅ Goal/reserve/category allocation share the canonical engine.
- ✅ FX conversion preserves original currency plus immutable base-equivalent metadata.
- ✅ Manual plan edits surface consequence explanations instead of silently changing goal/reserve pace.
- 🟡 Consequence previews can become more quantitative and personalized as beta UX is refined.

## Expenses and reconciliation
- ✅ Every expense is an individual stable-ID transaction.
- ✅ Funding source semantics distinguish category vs unallocated money.
- ✅ Overspend is split into `controlledAmount` and `uncontrolledAmount` using real balances.
- ✅ Category overspend cannot silently drive controlled balances below zero.
- ✅ Uncontrolled money is visible in history/analytics.
- ✅ New expenses require explicit acceptance when a recorded expense contains an uncontrolled portion.
- ✅ Editing an existing expense re-runs reconciliation against funds available before that transaction, preserves stable transaction identity/FX snapshot semantics, requires explicit acceptance for uncontrolled money, and clears stale acceptance metadata when fully controlled again.

## Account and authentication
- ✅ Supabase email/password authentication, session/logout and password recovery/change exist.
- ✅ Plaintext passwords are not stored in financial state.
- ✅ Account identity/preferences/avatar are separate from financial profiles.
- ✅ Private avatar upload exists.
- ✅ Live canonical RLS ownership policies were audited against the connected Supabase project.
- 🟡 Supabase leaked-password protection is disabled in the live project and should be enabled before beta sign-off.
- 🟡 Optional Google/Apple/phone sign-in remains non-blocking future convenience.
- 🟡 Real beta-environment auth/recovery verification remains a release task.

## Financial profiles
- ✅ One account may own multiple isolated financial profiles.
- ✅ Categories/goals/transactions/settings remain isolated locally and remotely.
- ✅ Profile switching/local-vault isolation have regression coverage.
- ✅ Base-currency changes are guarded after history exists.
- ✅ New-profile onboarding supports explicit templates and a clean-start path.
- 🟡 Profile copy/template refinement still needs final UX polish.
- 🟡 Destructive profile deletion needs final backup/recovery review before beta.

## Supabase persistence
- ✅ Account data, finance profiles, categories, goals and transactions persist remotely.
- ✅ Remote IDs, sync metadata, RLS-oriented schema/migrations and FX persistence exist.
- ✅ Goal lifecycle persistence has dedicated schema hardening.
- ✅ Canonical performance migration adds targeted indexes without weakening RLS boundaries.
- ✅ Browser runtime has a regression fence preventing direct dependency on legacy Supabase tables.
- ✅ Live canonical `finance_*` RLS/policy structure and migration intent were audited.
- 🟡 Migration history still needs an isolated replay/restore rehearsal instead of rewriting already-applied history.
- 🟡 Backup/restore rehearsal is not yet production-ready.
- 🟡 Compatibility-era tables still exist and should only be removed after recovery/replay proof.

## Offline-first and sync
- ✅ Core financial work remains local-first.
- ✅ Account-local vaults and IndexedDB recovery exist.
- ✅ Persistent mutation outboxes exist for transactions/categories/goals.
- ✅ Stable IDs, remote IDs, mutation IDs and retry metadata support idempotency.
- ✅ Category/goal deletions use outbox delete mutations.
- ✅ Legacy tombstones are converted one-way into canonical outbox deletes and no longer perform direct remote writes.
- ✅ Ambiguous-failure transaction retry is regression-tested against duplication.
- ✅ Concurrent remote changes are detected instead of silently overwritten.
- ✅ Remote-delete vs local-edit conflict cases have a dedicated matrix.
- ✅ Explicit local-vs-server conflict resolution UI exists and is locked into runtime loader order/tests.
- ✅ A consolidated two-device regression matrix covers offline edit, concurrent edit, delete-vs-edit, ambiguous retry and both conflict-resolution choices.
- 🟡 A final real two-device matrix still needs to be run against the beta Supabase environment.

## Currency
- ✅ RUB, EUR and USD are supported.
- ✅ Each profile has a base currency while each transaction retains original currency.
- ✅ Immutable FX snapshot/base-equivalent values support mixed-currency analytics.
- ✅ Offline FX cache plus Supabase-backed rate persistence/source exist.
- ✅ Stale cached-rate age/source is disclosed in UI without blocking offline-first work.
- 🟡 Historical-rate policy for imports and newly entered backdated operations should be documented explicitly.

## History and analytics
- ✅ Ledger operations remain the source of truth.
- ✅ Monthly/lifetime analytics are derived.
- ✅ Income, expenses, allocations, categories, goals, reserve, uncontrolled funds and trends are represented.
- ✅ History filters cover period/type/category/goal/source/currency/completed goals.
- ✅ Transaction inspector exposes reconciliation/currency/allocation details.
- ✅ Completed-goal lifecycle analytics are present and ledger-derived.
- 🟡 Charts still need final touch inspection, accessibility and drill-down polish.
- 🟡 Reserve lifecycle analytics deserve a dedicated transaction drill-down.

## Visual system and interactions
- ✅ A1-V3 dark premium visual language is integrated.
- ✅ Mobile bottom navigation and desktop navigation exist.
- ✅ Quick income/expense actions and sync/offline status are visible.
- ✅ Responsive/focus/touch/modal behavior has regression coverage.
- ✅ Motion is restrained and respects reduced-motion preferences.
- 🟡 Run a final dead-primary-action inventory after each cleanup because compatibility markup remains underneath override layers.
- 🟡 Final icons, empty/loading/error states and chart interactions need one coherent beta polish pass.

## Architecture
- ✅ Financial, product, account/auth, sync, currency, analytics and UI responsibilities are separated into modules.
- ✅ `index.html` removes the legacy financial block before effective runtime execution, preventing a second financial truth.
- ✅ Runtime-integrity checks enforce the canonical financial core at startup.
- ✅ GitHub Actions cover syntax, financial regressions, loader/bootstrap and headless UI contracts.
- ✅ Browser runtime is fenced from direct legacy Supabase-table access.
- 🟡 `app-shell.html` remains a large compatibility artifact and should eventually be physically simplified.
- 🟡 CSS/JS override layers should be consolidated after behavior stabilizes.

## Immediate prioritized backlog
### P0 — beta correctness/hardening
1. Run the real end-to-end two-device sync matrix against the beta Supabase environment, including offline edit, concurrent edit, delete-vs-edit, retry after ambiguous failure and explicit conflict resolution.
2. Perform isolated migration replay plus backup/restore rehearsal against a disposable/beta environment; do not rewrite applied production migration history.
3. Enable leaked-password protection in Supabase Auth and re-run the security/auth-recovery/RLS advisor checks before beta sign-off.
4. Review destructive financial-profile deletion against backup/recovery guarantees before exposing it as a beta-safe action.

### P1 — product completeness
1. Expand reserve lifecycle analytics with dedicated transaction drill-down.
2. Refine onboarding/profile templates and category-setting consequence copy after real-device use.
3. Document historical FX-rate policy for imports and newly entered backdated operations.
4. Make manual allocation consequence previews more quantitative where the calculation is trustworthy and useful.

### P2 — beta polish
1. Consolidate legacy shell/override layers and remove dead code/buttons.
2. Upgrade chart interaction/accessibility/drill-down.
3. Review loading/error/offline/retry states across every screen.
4. Run standalone mobile/desktop browser verification.
5. Perform a final dead-primary-action inventory and accessibility pass.

## Definition of beta-ready core
Do not reintroduce Vercel as an active dependency until all of the following are true:
- money conservation and cross-currency tests remain green;
- goal/reserve/category/unallocated balances remain transaction-derived;
- funded-goal closure cannot lose or duplicate money;
- completed-goal future-fund routing is persisted and honored;
- uncontrolled expense resolution is explicit for create/edit flows;
- multi-profile isolation remains covered;
- offline mutations survive reconnect/retry without duplicates;
- conflict cases are covered and explicitly resolvable;
- all entity writes use the canonical mutation/outbox path apart from deliberate one-way migrations;
- Supabase auth/RLS/migrations are verified against a beta environment;
- leaked-password protection is enabled before beta sign-off;
- backup/restore and migration replay have been rehearsed safely;
- no known dead primary action exists;
- standalone mobile/desktop verification passes;
- remaining release work is operational rather than architectural.
