# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `f38cc1ba754a03cfe1d4a5c7de524408a623b971` (2026-08-20).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE has moved beyond the original CRUD prototype. The current product now has a ledger-backed financial core, real account authentication, isolated financial profiles, Supabase persistence, local-first synchronization, mixed-currency support, transaction-derived analytics/history, and the A1-V3 product UI shell.

The highest-value remaining work is no longer foundational auth or basic ledger correctness. It is lifecycle completeness and production hardening: funded-goal closure/rerouting, completed-goal destination rules, stricter expense reconciliation UX, broader reserve semantics/runway inputs, sync conflict hardening, first-launch/onboarding cleanup, interactive chart polish, and beta/release verification.

Vercel remains intentionally outside the active development loop. GitHub Actions, branch/PR review and standalone/local artifacts are the active verification path until stable beta.

## Financial core
- ✅ `financial-core.js` is the single financial calculation source of truth in the effective runtime.
- ✅ Exact currency-unit conservation is enforced for accepted income plans.
- ✅ System unallocated/free remainder is separate from categories and does not depend on a category name.
- ✅ Category priority materially affects constrained allocation order.
- ✅ Monthly category and reserve limits are cumulative across multiple incomes.
- ✅ Goals participate in income allocation by priority/deadline/required pace.
- ✅ Goal balances are derived from ledger operations.
- ✅ Reserve is a ledger balance and supports withdrawals/transfers to goals.
- ✅ Expense controlled/uncontrolled amounts are explicit and derived from real available balances.
- ✅ Multi-profile financial isolation has regression coverage.
- 🟡 The main core is still surrounded by compatibility layers from the historical single-file shell; architecture is correct at runtime but not yet fully simplified physically.

## Categories
- ✅ User categories are editable and deletable.
- ✅ No magic category names.
- ✅ Primary fixed and percentage allocation semantics are implemented.
- ✅ Whole-number percentage model and cumulative monthly limits are enforced by the canonical engine.
- ✅ Category deletion has offline-sync tombstone protection.
- 🟡 First-launch category templates and onboarding copy still need a final product pass so examples never look like mandatory system categories.
- 🟡 Category settings UX can still be simplified and visually aligned more tightly with A1-V3.

## Reserve
- ✅ Reserve is separate from categories.
- ✅ Ledger-derived balance exists.
- ✅ Contribution settings and target/progress exist.
- ✅ Reserve withdrawals and reserve-to-goal funding preserve money conservation.
- ✅ Deterministic reserve progress/runway analytics helpers exist and analytics UI can show runway where inputs are available.
- 🟡 The product still needs a canonical user-facing definition of which expenses count as essential/living expenses for runway.
- 🟡 Reserve lifecycle UX should expose deposits/withdrawals/history as deliberately as goal flows.

## Goals
- ✅ Goals are financial entities integrated into allocation.
- ✅ Funding is represented by real operations; manual counter-only money creation is prevented.
- ✅ Goal contribution history is traceable from transactions.
- ✅ Completed goals stop receiving automatic allocations.
- ✅ Forecast/pace responds to target, deadline, priority and monthly plan.
- ✅ Goal sync, persistence and deletion tombstones exist for safely deletable goals.
- ✅ Funded goals are protected from destructive deletion.
- ❌ Canonical funded-goal close/delete flow is not complete: the user must be able to choose where remaining goal money goes without losing history or value.
- ❌ Canonical completed-goal future-funds rerouting rule is not yet persisted as a first-class destination rule.
- 🟡 Completed-goal history exists in History/filters, but the dedicated completion summary (duration, original vs actual forecast, completion method) can be richer.

## Income and allocation
- ✅ Every income is an individual transaction with stable ID, date, source, note and currency metadata.
- ✅ Any number of incomes per month is supported.
- ✅ Income proposals are generated before save and may be edited.
- ✅ Positive unallocated remainder is valid.
- ✅ Goal/reserve/category allocations share one canonical planner.
- ✅ FX conversion preserves original currency while storing base-equivalent values.
- 🟡 Consequence explanations for manual proposal changes are still limited; the core has the data needed, but UX should explain goal delay / reserve impact more directly.

## Expenses and reconciliation
- ✅ Each expense is an individual transaction with stable identity.
- ✅ Explicit category vs unallocated funding source semantics exist.
- ✅ Overspend is split into `controlledAmount` and `uncontrolledAmount` rather than silently corrupting balances.
- ✅ Category overspend consumes only the real category balance before becoming uncontrolled.
- ✅ History and analytics expose uncontrolled amounts.
- 🟡 The canonical reconciliation UX is still incomplete: when uncontrolled money appears, ARISE should offer a deliberate “identify the true source / accept uncontrolled” resolution flow rather than only reporting the result.
- 🟡 Editing an already-recorded expense should preserve reconciliation invariants with equally explicit UX.

## Account and authentication
- ✅ Supabase email/password authentication is implemented.
- ✅ Login/session/logout are real account actions.
- ✅ Password recovery/change exists.
- ✅ Plaintext password is not stored in local financial state.
- ✅ Account name/email/avatar/notification preferences are separate from financial profiles.
- ✅ Private avatar upload is supported.
- 🟡 Google/Apple/phone sign-in remain optional future convenience methods, not MVP blockers.
- 🟡 Production auth still needs final environment/RLS/recovery verification against a real beta Supabase project before release.

## Financial profiles
- ✅ One account may own multiple independent financial profiles.
- ✅ Profile categories/goals/transactions/settings remain isolated locally and remotely.
- ✅ Profile switching and local vault isolation have regression coverage.
- ✅ Base-currency change is guarded once financial history exists.
- 🟡 Profile creation/copy/template onboarding needs a final UX pass.
- 🟡 Destructive profile deletion should receive a final server/local recovery and backup review before beta.

## Supabase persistence
- ✅ Auth-linked account data is persisted.
- ✅ Finance profiles, categories, goals and transactions are persisted.
- ✅ Remote IDs and sync metadata exist.
- ✅ RLS-oriented schema/migrations are part of the repository.
- ✅ FX rates have persistence/server-source support.
- 🟡 Schema and client contracts should receive one consolidated migration audit before beta so compatibility migrations can be collapsed/documented cleanly.
- 🟡 Backup/restore and migration rollback procedures are not yet production-ready.

## Offline-first and sync
- ✅ Core financial work remains local-first.
- ✅ Structured local account vaults are isolated by authenticated account.
- ✅ IndexedDB/local persistence recovery path exists.
- ✅ Persistent mutation outbox exists for transactions/categories/goals.
- ✅ Stable IDs, remote IDs, mutation IDs and retry metadata are used for idempotency.
- ✅ Tombstones prevent deleted categories/goals from resurrecting after pull.
- ✅ Ambiguous-failure transaction retry is regression-tested against duplication.
- ✅ Sync status is exposed in the product UI.
- 🟡 Multi-device concurrent edits still need a dedicated end-to-end conflict matrix (same entity edited on two devices, delete-vs-edit, offline reorder, stale pull after newer local write).
- 🟡 Transition-era full-push/fallback paths should be reviewed and removed once the unified mutation queue is proven complete for every entity type.

## Currency
- ✅ RUB, EUR and USD are supported.
- ✅ Financial profile has a base currency.
- ✅ Transactions preserve original currency permanently.
- ✅ Immutable FX snapshots/base-equivalent amounts support mixed-currency ledger calculations.
- ✅ Offline FX cache and Supabase FX persistence/function source exist.
- ✅ Analytics no longer sum unrelated currencies as if numerically identical.
- 🟡 FX freshness/source disclosure and stale-rate UX can be improved before beta.
- 🟡 Historical-rate policy should be documented explicitly for edits/imports/backdated transactions.

## History and analytics
- ✅ Transactions remain the source of truth.
- ✅ Monthly/lifetime analytics are derived from ledger operations.
- ✅ Income, expenses, allocations, categories, goals, reserve, uncontrolled funds and trend comparisons are represented.
- ✅ History filters include month/period, type, category, goal, source and currency.
- ✅ Completed-goal filtering is available.
- ✅ Transaction inspector exposes reconciliation/currency/allocation detail.
- ✅ Profile switching resets history filters to avoid cross-profile UI leakage.
- 🟡 Charts are substantially improved but are not yet at the final interactive ARISE visual standard (touch inspection, richer semantic transitions, accessibility, drill-down).
- 🟡 Completed-goal analytics deserve a dedicated lifecycle view rather than only generic transaction/history inspection.

## Visual system and interactions
- ✅ A1-V3 dark premium visual language is integrated.
- ✅ Main navigation uses a mobile bottom bar and desktop sticky navigation.
- ✅ Quick income/expense actions are available from the main experience.
- ✅ Sync/offline state is visible.
- ✅ Responsive behavior, focus/touch states and modal polish have dedicated regression coverage.
- ✅ Motion is restrained and respects reduced-motion preferences.
- 🟡 A full dead-button/interaction inventory should still be run after each screen cleanup because legacy shell markup remains underneath compatibility layers.
- 🟡 Final iconography, empty states, skeleton/loading states and chart interactions need one coherent beta polish pass.

## Architecture
- ✅ Financial engine, runtime integration, product rules, account/auth, sync, currency, analytics and UI overrides are separated into modules.
- ✅ `index.html` strips the legacy financial block before effective runtime execution, avoiding a second financial truth.
- ✅ GitHub Actions provide syntax, financial regression, loader/bootstrap and headless UI coverage.
- 🟡 `app-shell.html` is still a large historical compatibility artifact; final simplification should remove dead inline code instead of only stripping it at boot.
- 🟡 CSS/JS override layers should be consolidated after behavior stabilizes to reduce long-term maintenance cost.

## Immediate prioritized backlog
### P0 — lifecycle correctness
1. Implement funded-goal close/delete transfer workflow with typed destination and preserved history.
2. Persist completed-goal future-funds rerouting destination.
3. Add strict expense reconciliation resolution flow for uncontrolled money.
4. Build a dedicated sync conflict matrix and eliminate any remaining full-push fallback once proven safe.

### P1 — product completeness
1. Finalize reserve essential-expense/runway input model and reserve lifecycle UX.
2. Finish first-launch/profile/category onboarding and template cleanup.
3. Add explicit consequence previews when users manually alter an income plan.
4. Expand completed-goal lifecycle analytics.

### P2 — beta polish
1. Consolidate legacy shell/override layers and remove dead code/buttons.
2. Upgrade chart interaction/accessibility/drill-down.
3. Review loading/error/offline/retry states across every screen.
4. Run mobile/desktop browser verification from standalone artifacts.
5. Perform Supabase migration/RLS/auth recovery audit and backup/restore rehearsal.

## Definition of beta-ready core
Do not reintroduce Vercel as an active dependency until all of the following are true:
- money conservation and cross-currency tests remain green;
- goal/reserve/category/free balances remain transaction-derived;
- funded-goal closure cannot lose or duplicate money;
- uncontrolled expense resolution is explicit;
- multi-profile isolation remains covered;
- offline mutations survive reconnect/retry without duplicates;
- multi-device conflict cases are covered;
- Supabase auth/RLS/migrations are verified against a beta environment;
- no known dead primary action exists;
- standalone mobile/desktop verification passes;
- the remaining release work is operational rather than architectural.
