# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `8e8487735c1852ba492f0c23cc4f4dc024bbd692` (2026-08-20).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE is now beyond foundational ledger/auth/sync work. `main` contains a ledger-backed financial core, account auth, isolated financial profiles, Supabase persistence, local-first outboxes, conflict detection and explicit local-vs-server resolution UI, mixed-currency support, transaction-derived history/analytics, funded-goal lifecycle protection, explicit expense reconciliation, and the A1-V3 product shell.

The highest-value remaining work is product-completeness and beta hardening rather than rebuilding foundations. Vercel remains intentionally outside the active development loop; GitHub Actions, branch/PR review and standalone/local artifacts are the verification path until stable beta.

## Financial core
- ✅ One effective financial calculation source of truth is used at runtime.
- ✅ Exact currency-unit conservation is regression-tested.
- ✅ System unallocated remainder is separate from user categories and names.
- ✅ Category priority, monthly limits, reserve and goals materially participate in allocation.
- ✅ Goal and reserve balances are transaction-derived.
- ✅ Explicit controlled/uncontrolled expense accounting is implemented.
- ✅ Multi-profile isolation has regression coverage.
- 🟡 Historical compatibility layers still surround the canonical runtime and should be physically consolidated before release.

## Categories
- ✅ User-defined categories are editable/deletable and have no magic names.
- ✅ Fixed and integer-percentage rules, priority, enabled state and monthly limits are implemented.
- ✅ Category sync uses persistent mutation queues/tombstones and conflict protection.
- 🟡 First-launch examples and category settings still need a final product/visual pass.

## Reserve
- ✅ Reserve is separate from categories and ledger-backed.
- ✅ Contribution settings, target/progress and deterministic runway analytics exist.
- ✅ Reserve withdrawals and reserve-to-goal funding preserve money conservation.
- 🟡 The canonical user-facing definition of essential/living expenses for runway still needs to be finalized.
- 🟡 Reserve deposit/withdrawal/history UX deserves the same deliberate lifecycle treatment as goals.

## Goals
- ✅ Goals participate in automatic allocation by priority/deadline/pace.
- ✅ Goal balances and contributions are transaction-derived.
- ✅ Completed goals stop receiving automatic allocations.
- ✅ Funded goals cannot be destructively deleted.
- ✅ Closing a funded goal requires a typed destination and preserves value/history; destinations include unallocated funds, reserve, or another eligible goal.
- ✅ Goal closure metadata is persisted/synced (`closed_at`, `closure_balance`, `closure_destination`).
- ✅ Closed goals remain visible as historical lifecycle entities.
- ❌ Completed-goal future-funds rerouting is not yet persisted and applied as a first-class allocation rule. This is the highest-priority remaining goal lifecycle gap.
- 🟡 Completion analytics can still be richer (duration, original vs actual forecast, completion method).

## Income and allocation
- ✅ Every income is an individual stable-ID transaction.
- ✅ Any number of incomes per month is supported.
- ✅ Proposal-before-save and manual editing exist.
- ✅ Positive unallocated remainder is valid.
- ✅ Goal/reserve/category allocation share the canonical engine.
- ✅ FX conversion preserves original currency plus immutable base-equivalent metadata.
- 🟡 Manual plan edits still need stronger consequence explanations (goal delay, reserve pace, etc.).

## Expenses and reconciliation
- ✅ Every expense is an individual stable-ID transaction.
- ✅ Funding source semantics distinguish category vs unallocated money.
- ✅ Overspend is split into `controlledAmount` and `uncontrolledAmount` using real balances.
- ✅ Category overspend cannot silently drive controlled balances below zero.
- ✅ Uncontrolled money is visible in history/analytics.
- ✅ The UI requires explicit acceptance when a recorded expense contains an uncontrolled portion and clears that requirement when the selected source fully covers the expense.
- 🟡 Editing an already-recorded expense should receive the same explicit reconciliation treatment end-to-end.

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
- 🟡 Profile creation/copy/template onboarding still needs final UX polish.
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
- ✅ Tombstones prevent category/goal resurrection after deletion.
- ✅ Ambiguous-failure transaction retry is regression-tested against duplication.
- ✅ Concurrent remote changes are detected instead of silently overwritten.
- ✅ Remote-delete vs local-edit conflict cases have a dedicated matrix.
- ✅ Explicit local-vs-server conflict resolution UI exists and is locked into runtime loader order/tests.
- 🟡 Transition-era fallback/full-sync paths should still be audited and removed where the unified mutation queue makes them unnecessary.
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

## Immediate prioritized backlog
### P0 — remaining lifecycle correctness
1. Persist completed-goal future-funds rerouting destination and apply it in the allocation engine without creating a second financial planner.
2. Give edits of existing expenses the same explicit reconciliation workflow as new expenses.
3. Audit/remove remaining transition-era full-push sync fallback paths after proving unified outbox coverage.

### P1 — product completeness
1. Finalize reserve essential-expense/runway input model and reserve lifecycle UX.
2. Finish first-launch/profile/category onboarding and template cleanup.
3. Add explicit consequence previews for manual income-plan changes.
4. Expand completed-goal lifecycle analytics.

### P2 — beta polish
1. Consolidate legacy shell/override layers and remove dead code/buttons.
2. Upgrade chart interaction/accessibility/drill-down.
3. Review loading/error/offline/retry states across every screen.
4. Run standalone mobile/desktop browser verification.
5. Perform Supabase migration/RLS/auth recovery audit and backup/restore rehearsal.

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
- Supabase auth/RLS/migrations are verified against a beta environment;
- no known dead primary action exists;
- standalone mobile/desktop verification passes;
- remaining release work is operational rather than architectural.
