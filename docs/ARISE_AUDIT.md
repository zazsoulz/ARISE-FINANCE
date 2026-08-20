# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `a7fee1213ea7265cf2de428800524da7d3e53b13` (2026-08-20).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE is now beyond foundational ledger/auth/sync work. `main` contains a ledger-backed financial core, account auth, isolated financial profiles, Supabase persistence, local-first mutation outboxes, conflict detection and explicit local-vs-server resolution UI, mixed-currency support, transaction-derived history/analytics, funded-goal lifecycle protection, completed-goal future-funds rerouting, explicit create/edit expense reconciliation, transaction-backed reserve lifecycle, consequence previews for manual income-plan edits, onboarding templates, and the A1-V3 product shell.

The previous P0 lifecycle-correctness backlog is substantially closed. The highest-value remaining work is beta hardening, removal of compatibility-era paths, product polish, and real beta-environment verification rather than rebuilding foundations. Vercel remains intentionally outside the active development loop; GitHub Actions, branch/PR review and standalone/local artifacts are the verification path until stable beta.

## Financial core
- ✅ One effective financial calculation source of truth is used at runtime.
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
- ✅ Category sync uses persistent mutation queues/tombstones and conflict protection.
- ✅ New-profile onboarding offers explicit starter templates instead of silently imposing one canonical budget.
- 🟡 Category settings still need a final visual/usability pass and clearer consequence language around priority/limit changes.

## Reserve
- ✅ Reserve is separate from categories and ledger-backed.
- ✅ Contribution settings, target/progress and deterministic runway analytics exist.
- ✅ Reserve deposits and withdrawals are transaction-backed.
- ✅ Reserve-to-goal funding preserves money conservation and transfer semantics through sync.
- ✅ Reserve lifecycle UI exposes deposit/withdrawal/history-oriented actions without mutating a standalone balance counter.
- 🟡 The canonical user-facing definition of essential/living expenses for runway still needs to be finalized.
- 🟡 Reserve history/analytics can still receive richer drill-down and completion-state polish.

## Goals
- ✅ Goals participate in automatic allocation by priority/deadline/pace.
- ✅ Goal balances and contributions are transaction-derived.
- ✅ Completed goals stop receiving automatic allocations.
- ✅ Funded goals cannot be destructively deleted.
- ✅ Closing a funded goal requires a typed destination and preserves value/history; destinations include unallocated funds, reserve, or another eligible goal.
- ✅ Goal closure metadata is persisted/synced (`closed_at`, `closure_balance`, `closure_destination`).
- ✅ Closed goals remain visible as historical lifecycle entities.
- ✅ Completed-goal future-funds rerouting is persisted and applied by the canonical allocation engine rather than a second planner.
- 🟡 Completion analytics can still be richer (duration, original vs actual forecast, completion method, rerouted future contributions).

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
- 🟡 Optional Google/Apple/phone sign-in remains non-blocking future convenience.
- 🟡 Real beta-environment auth/recovery/RLS verification remains a release task.

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
- 🟡 Migration history should receive one consolidated compatibility/rollback audit before beta.
- 🟡 Backup/restore rehearsal is not yet production-ready.

## Offline-first and sync
- ✅ Core financial work remains local-first.
- ✅ Account-local vaults and IndexedDB recovery exist.
- ✅ Persistent mutation outboxes exist for transactions/categories/goals.
- ✅ Stable IDs, remote IDs, mutation IDs and retry metadata support idempotency.
- ✅ New category/goal deletions are represented as outbox delete mutations rather than new tombstones.
- ✅ Legacy tombstones are still drained for backward compatibility with older vaults.
- ✅ Ambiguous-failure transaction retry is regression-tested against duplication.
- ✅ Concurrent remote changes are detected instead of silently overwritten.
- ✅ Remote-delete vs local-edit conflict cases have a dedicated matrix.
- ✅ Explicit local-vs-server conflict resolution UI exists and is locked into runtime loader order/tests.
- ✅ The sync engine seeds/drains mutation queues and no longer contains a full transaction push loop; this contract has dedicated regression coverage.
- 🟡 Legacy tombstone migration still has a direct compatibility delete path; migrate that final compatibility path into the unified outbox before beta.
- 🟡 A final end-to-end two-device test matrix should be run against a beta Supabase environment.

## Currency
- ✅ RUB, EUR and USD are supported.
- ✅ Each profile has a base currency while each transaction retains original currency.
- ✅ Immutable FX snapshot/base-equivalent values support mixed-currency analytics.
- ✅ Offline FX cache plus Supabase-backed rate persistence/source exist.
- 🟡 FX freshness/source disclosure and stale-rate UX can be improved.
- 🟡 Historical-rate policy for edits/imports/backdated operations should be documented explicitly.

## History and analytics
- ✅ Ledger operations remain the source of truth.
- ✅ Monthly/lifetime analytics are derived.
- ✅ Income, expenses, allocations, categories, goals, reserve, uncontrolled funds and trends are represented.
- ✅ History filters cover period/type/category/goal/source/currency/completed goals.
- ✅ Transaction inspector exposes reconciliation/currency/allocation details.
- 🟡 Charts still need final touch inspection, accessibility and drill-down polish.
- 🟡 Completed-goal analytics deserve a dedicated lifecycle summary.
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
- ✅ GitHub Actions cover syntax, financial regressions, loader/bootstrap and headless UI contracts.
- 🟡 `app-shell.html` remains a large compatibility artifact and should eventually be physically simplified.
- 🟡 CSS/JS override layers should be consolidated after behavior stabilizes.
- 🟡 Legacy tombstone compatibility should be converted into a one-way outbox migration so all remote entity writes use one mutation path.

## Immediate prioritized backlog
### P0 — beta correctness/hardening
1. Convert legacy category/goal tombstone cleanup into the unified mutation outbox and remove the remaining direct compatibility delete write-path.
2. Run an end-to-end two-device sync matrix against a beta Supabase environment, including offline edit, concurrent edit, delete-vs-edit, retry after ambiguous failure, and explicit conflict resolution.
3. Perform one consolidated Supabase migration/RLS/auth-recovery audit and backup/restore rehearsal.

### P1 — product completeness
1. Finalize reserve essential-expense/runway input model.
2. Expand completed-goal and reserve lifecycle analytics.
3. Refine onboarding/profile templates and category-setting consequence copy after real-device use.
4. Document historical FX-rate policy for edits/imports/backdated operations and expose stale-rate/source state clearly.

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
- no known dead primary action exists;
- standalone mobile/desktop verification passes;
- remaining release work is operational rather than architectural.
