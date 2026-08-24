# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `ad07a38fdb8f40c40703183cfa2b3f6b9f5d0b95` (2026-08-23).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE is beyond foundational ledger/auth/sync work. `main` contains a ledger-backed financial core, account auth, isolated financial profiles, Supabase persistence, local-first mutation outboxes, explicit sync-conflict resolution, mixed-currency support, transaction-derived history/analytics, funded-goal lifecycle protection, completed-goal future-funds rerouting, explicit create/edit expense reconciliation, transaction-backed reserve lifecycle, quantitative consequence previews, onboarding templates, completed-goal analytics, stale/backdated FX disclosure, explicit essential-expense reserve runway inputs, recoverable finance-profile archiving, reserve transaction drill-down, accessible analytics chart data, actionable sync/bootstrap states and a production-equivalent standalone preview path.

The highest-value remaining work is now operational beta verification, final shell consolidation and cross-screen product polish. Physical compatibility-shell removal has progressed materially: legacy `renderTopbar`, navigation source, `renderHome`, `renderIncome`, `renderGoals`, `renderHistory` and `renderAnalytics` are physically gone from `app-shell.html`. `renderSettings` is now the final legacy screen renderer still physically present, even though canonical Settings ownership already lives in `settings-ui.js`. Vercel remains intentionally outside the active development loop until stable beta/production.

## Financial core
- ✅ One effective financial calculation source of truth is used at runtime.
- ✅ Startup fails closed if the canonical financial runtime is missing or the compatibility financial engine was not stripped.
- ✅ Exact currency-unit conservation is regression-tested.
- ✅ System unallocated remainder is separate from user categories and names.
- ✅ Category priority, monthly limits, reserve and goals materially participate in allocation.
- ✅ Goal and reserve balances are transaction-derived.
- ✅ Explicit controlled/uncontrolled expense accounting is implemented for create and edit flows.
- ✅ Multi-profile isolation has regression coverage.
- 🟡 Historical compatibility helpers still surround the canonical runtime and are being removed behind regression gates.

## Categories
- ✅ User-defined categories are editable/deletable and have no magic names.
- ✅ Fixed and integer-percentage rules, priority, enabled state and monthly limits are implemented.
- ✅ Category sync uses persistent mutation queues and conflict protection.
- ✅ Legacy category tombstones migrate one-way into the unified entity outbox; no direct compatibility delete write-path remains.
- ✅ New-profile onboarding offers explicit starter templates instead of silently imposing one canonical budget.
- ✅ Category settings explain practical consequences of rule/priority/limit changes.
- 🟡 Final real-device usability polish remains after shell consolidation.

## Reserve
- ✅ Reserve is separate from categories and ledger-backed.
- ✅ Contribution settings, target/progress and deterministic runway analytics exist.
- ✅ Reserve deposits and withdrawals are transaction-backed.
- ✅ Reserve-to-goal funding preserves money conservation and transfer semantics through sync.
- ✅ Runway uses explicit user-controlled essential-spend inputs: manual monthly amount or selected essential categories.
- ✅ Reserve history supports transaction drill-down without creating a second balance source.
- 🟡 Reserve completion-state presentation can still receive final visual polish.

## Goals
- ✅ Goals participate in automatic allocation by priority/deadline/pace.
- ✅ Goal balances and contributions are transaction-derived.
- ✅ Completed goals stop receiving automatic allocations.
- ✅ Funded goals cannot be destructively deleted.
- ✅ Closing a funded goal requires a typed destination and preserves value/history.
- ✅ Closure metadata is persisted/synced.
- ✅ Closed goals remain visible historically.
- ✅ Completed-goal future-funds rerouting is persisted and applied by the canonical allocation engine.
- ✅ Completed-goal analytics are ledger-derived.
- 🟡 Completion/reroute presentation can still receive final UX polish.

## Income and allocation
- ✅ Every income is an individual stable-ID transaction.
- ✅ Any number of incomes per month is supported.
- ✅ Proposal-before-save and manual editing exist.
- ✅ Positive unallocated remainder is valid.
- ✅ Goal/reserve/category allocation share the canonical engine.
- ✅ FX conversion preserves original currency plus immutable base-equivalent metadata.
- ✅ Manual plan edits surface consequence explanations.
- ✅ Reserve impact is quantified when target/progress data is trustworthy.

## Expenses and reconciliation
- ✅ Every expense is an individual stable-ID transaction.
- ✅ Funding source semantics distinguish category vs unallocated money.
- ✅ Overspend is split into `controlledAmount` and `uncontrolledAmount` using real balances.
- ✅ Category overspend cannot silently drive controlled balances below zero.
- ✅ Uncontrolled money is visible in history/analytics.
- ✅ New expenses require explicit acceptance when an uncontrolled portion exists.
- ✅ Editing an existing expense re-runs reconciliation against funds available before that transaction and preserves stable transaction identity/FX snapshot semantics.

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
- ✅ New-profile onboarding supports explicit templates and clean-start.
- ✅ Profiles containing financial history use recoverable archive-first deletion semantics.
- ✅ Archived profiles can be restored and rehydrated from the server.
- 🟡 Profile copy/template refinement still needs final UX polish.

## Supabase persistence
- ✅ Account data, finance profiles, categories, goals and transactions persist remotely.
- ✅ Remote IDs, sync metadata, RLS-oriented schema/migrations and FX persistence exist.
- ✅ Goal lifecycle persistence has dedicated schema hardening.
- ✅ Canonical performance migration adds targeted indexes without weakening RLS boundaries.
- ✅ Browser runtime has a regression fence preventing direct dependency on legacy Supabase tables.
- ✅ Live canonical `finance_*` RLS/policy structure and migration intent were audited.
- 🟡 Migration history still needs isolated replay/restore rehearsal.
- 🟡 Backup/restore rehearsal is not yet production-ready.
- 🟡 Compatibility-era tables should only be removed after recovery/replay proof.

## Offline-first and sync
- ✅ Core financial work remains local-first.
- ✅ Account-local vaults and IndexedDB recovery exist.
- ✅ Persistent mutation outboxes exist for transactions/categories/goals.
- ✅ Stable IDs, remote IDs, mutation IDs and retry metadata support idempotency.
- ✅ Category/goal deletions use outbox delete mutations.
- ✅ Legacy tombstones are converted one-way into canonical outbox deletes.
- ✅ Ambiguous-failure transaction retry is regression-tested against duplication.
- ✅ Concurrent remote changes are detected instead of silently overwritten.
- ✅ Remote-delete vs local-edit conflict cases have dedicated coverage.
- ✅ Explicit local-vs-server conflict resolution UI exists.
- ✅ Consolidated two-device regression coverage includes offline edit, concurrent edit, delete-vs-edit, ambiguous retry and both conflict-resolution choices.
- ✅ Global sync status distinguishes offline/local-only/syncing/error/conflict/synced and exposes safe actions.
- 🟡 A final real two-device matrix still needs to run against the beta Supabase environment.

## Currency
- ✅ RUB, EUR and USD are supported.
- ✅ Each profile has a base currency while each transaction retains original currency.
- ✅ Immutable FX snapshot/base-equivalent values support mixed-currency analytics.
- ✅ Offline FX cache plus Supabase-backed rate persistence/source exist.
- ✅ Stale cached-rate age/source is disclosed without blocking offline work.
- ✅ Historical/backdated FX behavior is documented and disclosed; saved transactions are never silently revalued.

## History and analytics
- ✅ Ledger operations remain the source of truth.
- ✅ Monthly/lifetime analytics are derived.
- ✅ Income, expenses, allocations, categories, goals, reserve, uncontrolled funds and trends are represented.
- ✅ History filters cover period/type/category/goal/source/currency/completed goals.
- ✅ Transaction inspector exposes reconciliation/currency/allocation details.
- ✅ Completed-goal lifecycle analytics are present and ledger-derived.
- ✅ Reserve history has dedicated transaction drill-down.
- ✅ Financial-pulse chart data has a keyboard-accessible semantic table fallback.
- 🟡 Charts still need final real-device touch inspection and interaction polish.

## Visual system and interactions
- ✅ A1-V3 dark premium visual language is integrated.
- ✅ Calm always-on motion exists without turning the interface into a distracting animation layer.
- ✅ Mobile bottom navigation and desktop navigation exist.
- ✅ Quick income/expense actions and sync/offline status are visible.
- ✅ Responsive/focus/touch/modal behavior has regression coverage.
- ✅ Motion respects reduced-motion preferences.
- ✅ Production primary actions have dedicated smoke coverage, including reserve lifecycle actions.
- ✅ Bootstrap failure and global sync/error/conflict states are actionable.
- ✅ Core empty states now expose useful next actions instead of dead ends.
- 🟡 Final screen-by-screen loading/error/offline/retry consistency review remains.
- 🟡 Final icon and real-device touch polish remains before beta sign-off.

## Architecture
- ✅ Financial, product, account/auth, sync, currency, analytics and UI responsibilities are separated into modules.
- ✅ `index.html` removes the legacy financial block before effective runtime execution, preventing a second financial truth.
- ✅ Runtime-integrity checks enforce the canonical financial core at startup.
- ✅ GitHub Actions cover syntax, financial regressions, loader/bootstrap, physical-cleanup guards and headless UI contracts.
- ✅ Browser runtime is fenced from direct legacy Supabase-table access.
- ✅ Standalone preview is assembled from the canonical runtime manifest rather than a divergent loader.
- ✅ Canonical screen ownership is external to the compatibility shell for Topbar, Navigation, Home, Income, Goals, History, Analytics and Settings.
- ✅ Legacy `renderTopbar`, `NAV_ITEMS + renderNav`, `renderHome`, `renderIncome`, `renderGoals`, `renderHistory + historyMonthBlock` and `renderAnalytics` have been physically removed from `app-shell.html`.
- ✅ Shared navigation/profile-switch helpers live in `navigation-compat.js`.
- ✅ Physical cleanup scripts are fail-closed and are executed by CI in read-only guard mode.
- ✅ A guarded physical-removal transform exists for legacy `renderSettings()` and is wired into CI.
- 🟡 Legacy `renderSettings()` source is the final legacy screen renderer still physically present; remove it atomically with its retirement-registry entry while preserving `categoryEditor` and remaining shared helpers.
- 🟡 Remaining shared compatibility helpers/CSS should continue to be consolidated only behind behavior-preserving regression gates.

## Immediate prioritized backlog
### P0 — beta correctness/hardening
1. Run the real end-to-end two-device sync matrix against the beta Supabase environment, including offline edit, concurrent edit, delete-vs-edit, retry after ambiguous failure and explicit conflict resolution.
2. Perform isolated migration replay plus backup/restore rehearsal against a disposable/beta environment; do not rewrite applied production migration history.
3. Enable leaked-password protection in Supabase Auth and re-run the security/auth-recovery/RLS advisor checks before beta sign-off.

### P1 — product completeness
1. Refine onboarding/profile templates after real-device use.
2. Polish completed-goal closure/rerouting presentation and reserve completion-state presentation.
3. Keep consequence previews quantitative only where the calculation is deterministic and useful.

### P2 — beta polish / consolidation
1. Physically remove legacy `renderSettings()` using the existing guarded transform, update the retirement registry and run the full CI gate.
2. Continue shrinking remaining compatibility helpers/CSS only after ownership is explicit and regression protected.
3. Review loading/error/offline/retry states screen by screen for consistent actions and copy.
4. Finish real-device chart/touch interaction polish and final icon pass.
5. Run standalone mobile/desktop browser verification using the canonical manifest-based preview artifact.
6. Perform the final dead-primary-action inventory and accessibility pass after consolidation.

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
