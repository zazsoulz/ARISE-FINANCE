# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs `main` at `7eafc5773ea26d08f88ec2a52ee387912657f671` (2026-08-23).

Legend: ✅ substantially present; 🟡 partial / requires hardening; ❌ absent.

## Executive summary
ARISE is beyond foundational ledger/auth/sync work. `main` contains a ledger-backed financial core, account auth, isolated financial profiles, Supabase persistence, local-first mutation outboxes, conflict detection and explicit local-vs-server resolution UI, mixed-currency support, transaction-derived history/analytics, funded-goal lifecycle protection, completed-goal future-funds rerouting, explicit create/edit expense reconciliation, transaction-backed reserve lifecycle, quantitative consequence previews for manual income-plan edits, onboarding templates, completed-goal lifecycle analytics, stale-FX disclosure, explicit essential-expense reserve runway inputs, historical/backdated FX policy disclosure, recoverable finance-profile archiving, reserve transaction drill-down, accessible analytics chart data, actionable global sync states, actionable bootstrap recovery and a production-equivalent standalone preview path.

The lifecycle-correctness and compatibility-delete backlog is closed. The highest-value remaining work is now real beta-environment verification, operational Supabase hardening, staged compatibility-shell removal and final cross-screen product polish. The shell consolidation is no longer only conceptual: legacy topbar source has been physically removed, the canonical navigation/profile helpers were extracted, and the loader is prepared for physical removal of the remaining legacy navigation model/renderer without reintroducing duplicate ownership. Vercel remains intentionally outside the active development loop; GitHub Actions, branch/PR review and standalone/local artifacts remain the verification path until stable beta.

## Financial core
- ✅ One effective financial calculation source of truth is used at runtime.
- ✅ Startup fails closed if the canonical financial runtime is missing or the compatibility financial engine was not stripped.
- ✅ Exact currency-unit conservation is regression-tested.
- ✅ System unallocated remainder is separate from user categories and names.
- ✅ Category priority, monthly limits, reserve and goals materially participate in allocation.
- ✅ Goal and reserve balances are transaction-derived.
- ✅ Explicit controlled/uncontrolled expense accounting is implemented for create and edit flows.
- ✅ Multi-profile isolation has regression coverage.
- 🟡 Historical compatibility layers still surround the canonical runtime and are being physically removed in staged, regression-gated steps.

## Categories
- ✅ User-defined categories are editable/deletable and have no magic names.
- ✅ Fixed and integer-percentage rules, priority, enabled state and monthly limits are implemented.
- ✅ Category sync uses persistent mutation queues and conflict protection.
- ✅ Legacy category tombstones are migrated one-way into the unified entity outbox; no direct compatibility delete write-path remains.
- ✅ New-profile onboarding offers explicit starter templates instead of silently imposing one canonical budget.
- ✅ Category settings explain practical consequences of rule/priority/limit changes instead of presenting controls without context.
- 🟡 Category settings still deserve final real-device usability polish after shell consolidation.

## Reserve
- ✅ Reserve is separate from categories and ledger-backed.
- ✅ Contribution settings, target/progress and deterministic runway analytics exist.
- ✅ Reserve deposits and withdrawals are transaction-backed.
- ✅ Reserve-to-goal funding preserves money conservation and transfer semantics through sync.
- ✅ Reserve lifecycle UI exposes deposit/withdrawal/history-oriented actions without mutating a standalone balance counter.
- ✅ Runway uses an explicit user-controlled model: manual monthly essential spend or explicitly selected essential categories; ARISE no longer silently treats all spending as essential.
- ✅ Reserve history supports transaction drill-down without creating a second balance source.
- 🟡 Reserve completion-state presentation can still receive final visual polish.

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
- ✅ Reserve impact is quantified when a trustworthy target/progress calculation is available.
- 🟡 Further personalization should only be added where the calculation remains deterministic and understandable.

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
- ✅ Profiles containing financial history use recoverable archive-first deletion semantics; local data is not discarded if server archival cannot be confirmed.
- ✅ Archived profiles can be restored and rehydrated from the server.
- 🟡 Profile copy/template refinement still needs final UX polish.

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
- ✅ Global sync status distinguishes offline/local-only/syncing/error/conflict/synced and exposes safe retry or conflict-resolution actions.
- 🟡 A final real two-device matrix still needs to be run against the beta Supabase environment.

## Currency
- ✅ RUB, EUR and USD are supported.
- ✅ Each profile has a base currency while each transaction retains original currency.
- ✅ Immutable FX snapshot/base-equivalent values support mixed-currency analytics.
- ✅ Offline FX cache plus Supabase-backed rate persistence/source exist.
- ✅ Stale cached-rate age/source is disclosed in UI without blocking offline-first work.
- ✅ Historical/backdated FX behavior is explicitly documented and disclosed: ARISE freezes the rate available at save time unless a verified historical-rate provider is introduced later.

## History and analytics
- ✅ Ledger operations remain the source of truth.
- ✅ Monthly/lifetime analytics are derived.
- ✅ Income, expenses, allocations, categories, goals, reserve, uncontrolled funds and trends are represented.
- ✅ History filters cover period/type/category/goal/source/currency/completed goals.
- ✅ Transaction inspector exposes reconciliation/currency/allocation details.
- ✅ Completed-goal lifecycle analytics are present and ledger-derived.
- ✅ Reserve history has dedicated transaction drill-down.
- ✅ Financial-pulse chart data has a keyboard-accessible semantic table fallback/drill-down.
- 🟡 Charts still need final real-device touch inspection and interaction polish beyond the accessible data fallback.

## Visual system and interactions
- ✅ A1-V3 dark premium visual language is integrated.
- ✅ Mobile bottom navigation and desktop navigation exist.
- ✅ Quick income/expense actions and sync/offline status are visible.
- ✅ Responsive/focus/touch/modal behavior has regression coverage.
- ✅ Motion is restrained and respects reduced-motion preferences.
- ✅ Production primary actions have dedicated smoke coverage, including reserve lifecycle actions.
- ✅ Bootstrap failure has an actionable recovery state, including a distinct offline explanation and retry action.
- ✅ Global sync/error/conflict states are actionable instead of passive indicators.
- 🟡 Empty/loading/error/retry behavior still needs a final screen-by-screen consistency pass.
- 🟡 Final icon and touch-interaction polish remains before beta sign-off.

## Architecture
- ✅ Financial, product, account/auth, sync, currency, analytics and UI responsibilities are separated into modules.
- ✅ `index.html` removes the legacy financial block before effective runtime execution, preventing a second financial truth.
- ✅ Runtime-integrity checks enforce the canonical financial core at startup.
- ✅ GitHub Actions cover syntax, financial regressions, loader/bootstrap and headless UI contracts.
- ✅ Browser runtime is fenced from direct legacy Supabase-table access.
- ✅ Standalone preview is assembled from the canonical runtime manifest rather than a divergent hand-maintained loader.
- ✅ Legacy `renderTopbar()` source is physically removed from `app-shell.html`; initial rendering is owned by canonical bootstrap.
- ✅ Shared navigation/profile-switch helpers are extracted into `navigation-compat.js` so legacy nav source can be removed without losing behavior.
- ✅ Effective runtime already excludes legacy `NAV_ITEMS` and `renderNav()`, and loader/tests now tolerate their physical absence while still failing closed on malformed legacy blocks.
- 🟡 `app-shell.html` remains a large compatibility artifact; the next staged source-removal target is `NAV_ITEMS + renderNav`, followed by the remaining retired screen renderers one at a time.
- 🟡 Remaining CSS/JS compatibility layers should continue to be consolidated only behind regression gates.

## Immediate prioritized backlog
### P0 — beta correctness/hardening
1. Run the real end-to-end two-device sync matrix against the beta Supabase environment, including offline edit, concurrent edit, delete-vs-edit, retry after ambiguous failure and explicit conflict resolution.
2. Perform isolated migration replay plus backup/restore rehearsal against a disposable/beta environment; do not rewrite applied production migration history.
3. Enable leaked-password protection in Supabase Auth and re-run the security/auth-recovery/RLS advisor checks before beta sign-off.

### P1 — product completeness
1. Refine onboarding/profile templates after real-device use.
2. Polish completed-goal closure/rerouting presentation and reserve completion-state presentation.
3. Keep consequence previews quantitative only where the calculation is deterministic and useful; avoid decorative forecasts.

### P2 — beta polish
1. Continue staged physical shell consolidation: remove `NAV_ITEMS + renderNav` from `app-shell.html`, shrink the retirement registry, then remove each remaining retired renderer only after the full regression gate passes.
2. Review empty/loading/error/offline/retry states screen by screen for consistent actions and copy.
3. Finish real-device chart/touch interaction polish and final icon pass.
4. Run standalone mobile/desktop browser verification using the canonical manifest-based preview artifact.
5. Perform the final dead-primary-action inventory and accessibility pass after consolidation.

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