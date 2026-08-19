# ARISE FINANCE — Current Implementation Gap Audit

Basis: `docs/ARISE_SPEC.md` vs current `main` implementation as of 2026-08-19.

Legend: ✅ substantially present; 🟡 partial/incorrect; ❌ absent or architecturally incompatible.

## Executive summary
The current application is a useful UI/CRUD prototype, not yet a production financial system. The strongest reusable asset is the visual/UI shell and basic transaction/profile CRUD. The weakest area is the financial domain model: account/auth, free money/remainder, goals, reserve, categories, analytics and storage are not yet governed by one coherent source-of-truth model.

Do not add large new UI features until the financial engine and persistence model are stabilized.

## Product/UI shell
- ✅ Mobile-responsive dark premium visual language exists.
- ✅ Main navigation/screens exist: home, income, expenses, goals, history, analytics, settings.
- ✅ Modal, cards, stats, basic charts, progress UI and feedback/toasts exist.
- 🟡 Charts are static/simple bar visuals rather than the target interactive ARISE analytics language.
- 🟡 Current app is a ~147 KB single `index.html`, mixing styles, domain logic, state, persistence and rendering. This materially increases regression risk.

## Account/auth
- 🟡 A registration UI exists with name/email/password/avatar file.
- ❌ Registration is not secure production authentication; `registered` is a local state flag.
- ❌ Plain password is stored in local application state/localStorage.
- ❌ Real login/session/logout is absent.
- ❌ Password change/recovery is absent.
- ❌ Notification preference exists in state but has no complete settings UX.
- 🟡 Account settings currently expose only part of canonical account data.
- ✅ Avatar file input has replaced URL-only photo entry in current code.

Required action: stop extending local fake auth; implement Supabase Auth and a local session/offline-compatible user model.

## Financial profiles
- ✅ Multiple profiles can be created, switched and deleted.
- ✅ Transactions/goals/categories/settings are nested per profile locally, giving basic isolation.
- 🟡 Production persistence/sync for finance profiles is absent.
- 🟡 Profile creation modes/template/copy described in old README are not reliably present in current implementation.

## Categories
- ✅ User categories have name, type, percent, fixed amount, priority, limit, enabled state.
- 🟡 Category editor still exposes a special `remainder` type, which conflicts with the canonical rule that system remainder is not a category mode.
- 🟡 Starter template has been edited during development and is not yet locked to canonical first-launch behavior.
- 🟡 Percent preset model is hard-coded and does not fully express the desired whole-number 1–100 rule cleanly.
- 🟡 Priority is largely cosmetic: percentage categories are sorted by priority but still receive their independent percentage; priority does not meaningfully resolve constrained allocation.
- 🟡 Limits are applied per income calculation, not robustly as accumulated monthly limits across all incomes.

## Reserve
- ✅ Reserve is already modeled separately from categories in profile settings.
- ✅ Enabled/percent/per-income limit UI exists.
- 🟡 Current reserve logic is contribution-oriented, not a full reserve ledger/balance model.
- ❌ Reserve target/progress is not a first-class model.
- ❌ Financial runway (months of protection based on living/essential spend) is absent.
- 🟡 `lifetimeReserve` sums income allocation records; reserve withdrawals/uses are not modeled as a robust balance flow.

## Income
- ✅ Every income is stored separately with amount/date/source/currency/note/allocations.
- ✅ Multiple incomes per month work naturally.
- ✅ Automatic proposal and manual editing UI exist.
- 🟡 Proposal validation currently expects exact full distribution and treats positive unallocated room as an error.
- 🟡 Current engine is not goal-aware.
- 🟡 Current engine does not enforce accumulated monthly category limits.
- 🟡 Manual plan editing does not explain consequence changes to goals/reserve.

## Free money / system remainder
- ❌ Current `monthStats()` still treats `stats.allocations["Свободные деньги"]` as system free money.
- ❌ This makes a user category name act as a reserved implementation key.
- 🟡 `remainder` has begun to be added to income transactions, but the complete chain (validation → save → statistics → expenses → backwards compatibility) is not yet finished in `main`.
- 🟡 Expense default source still uses the literal label «Свободные деньги», which conflates product wording with domain identity.

This is the current highest-priority engine bug and is being handled in a dedicated PR.

## Expenses / uncontrolled money
- ✅ Expense transaction CRUD exists.
- ✅ User may select a category or leave category blank.
- 🟡 Spending from a selected category subtracts from derived allocation statistics but there is no rigorous category ledger/balance model.
- ❌ Uncontrolled/untracked funds are not modeled as a distinct financial event/value.
- ❌ Overspend is currently warning-only; unexplained excess is not stored and therefore cannot appear correctly in analytics/history.
- ❌ ARISE does not yet offer the canonical strict reconciliation flow (identify source vs accept uncontrolled funds).

## Goals
- ✅ Goal CRUD, target/current, priority, deadline, monthlyContribution, progress, basic forecast and completed state exist.
- ❌ Goal funding is not financially connected to transactions/allocations: current manual funding can increase `goal.current` without moving money from any real source.
- ❌ Goals do not participate in income distribution.
- 🟡 Forecast uses configured monthlyContribution rather than robust historical contribution dynamics.
- ❌ Contribution history is not a first-class ledger.
- ❌ Completed-goal rerouting rule is absent.
- ❌ Closing/deleting a funded goal does not reconcile the money destination.
- 🟡 Completed goals are displayed, but not with the requested full historical analysis.

This is the second major domain rewrite after the core allocation model.

## History/statistics/analytics
- ✅ Transactions remain individually inspectable and months are derived from transaction dates.
- ✅ Basic monthly income/expense/reserve/category aggregation exists.
- ✅ Basic all-time income/expense, source and expense-category analytics exist.
- 🟡 History filtering is very limited compared with spec.
- ❌ Uncontrolled funds analytics absent.
- ❌ Goal contribution analytics/history absent.
- ❌ Reserve runway absent.
- 🟡 Cross-month comparison is basic and visually generic.
- 🟡 Currency conversion is not implemented; values of different currencies can be aggregated incorrectly as if numerically comparable.

## Currency
- ✅ RUB/EUR/USD UI values exist and transactions retain currency.
- ❌ Base-currency conversion using exchange rates is not wired into statistics.
- ❌ Existing `exchange_rates` SQL table is unused by the current client.
- ❌ Historical/original vs converted analytics policy is not implemented.

## Offline-first / persistence
- ✅ LocalStorage currently makes the prototype usable without internet on one browser/device.
- ✅ Stable random UUID-like IDs are used for local entities/operations.
- ❌ There is no real synchronization queue/outbox.
- ❌ There is no server reconciliation/conflict strategy.
- ❌ Duplicate prevention/idempotency across devices is absent.
- ❌ Sync metadata/version/timestamps appropriate for conflict resolution are incomplete.

## Supabase/schema
- ✅ Repository contains a Supabase schema with auth-linked user profile, finance profiles, goals, transactions, allocations, RLS and exchange rates.
- ✅ Repository contains a publishable Supabase configuration file.
- ❌ `index.html` does not currently use Supabase APIs.
- 🟡 SQL schema is not yet sufficient for canonical product: categories, reserve ledger/target, goal contribution history, expense funding source, uncontrolled funds, sync metadata/outbox semantics and richer allocations need explicit modeling.
- 🟡 `profiles` table naming may confuse account profile vs finance profile; domain naming should be clarified during migration.

## Source-of-truth violations
Current implementation has several places where financial meaning is inferred from display/category names or maintained through mutable counters rather than operations:
- system free money inferred from category name;
- goal current balance can be manually incremented without a transaction;
- reserve is summarized only from income records, with no reserve flow ledger;
- category balances are inferred from aggregated allocation names/expense names;
- currency values may be summed without conversion.

Canonical fix: transactions + typed allocations/transfers are source of truth; balances/statistics derive from those operations.

## Old README drift
Current README claims features such as Calendar, What-if, onboarding, dynamic goal priority, profile template/copy modes and production auth hooks that do not match the current `main/index.html` consistently. README should be replaced/updated after the architecture stabilization and must not be used as product truth.

## Recommended build sequence
### Phase 0 — Freeze the contract
1. Merge `ARISE_SPEC.md`.
2. Keep product decisions in spec; later decisions explicitly amend it.
3. Add financial-engine tests before significant new UI.

### Phase 1 — Financial core
1. Remove magic category names and special remainder category semantics.
2. Define typed money destinations and exact balance equations.
3. Implement one allocation engine.
4. Implement accumulated monthly limits.
5. Make priority meaningful under constrained funds.
6. Implement one currency-unit rounding correction mechanism.
7. Add deterministic tests for at least 20 financial scenarios.

### Phase 2 — Goals and reserve
1. Connect goals to allocations/transfers.
2. Build goal contribution ledger/history and forecasting.
3. Implement completion/closure rerouting.
4. Build reserve as a real balance/target flow.
5. Add reserve runway calculation.

### Phase 3 — Expenses/reconciliation
1. Define category/free/goal/reserve funding sources explicitly by ID/type.
2. Record uncontrolled/untracked funding amount when required.
3. Build reconciliation UX and strict but human explanations.

### Phase 4 — Account/Supabase
1. Implement real Supabase Auth and session lifecycle.
2. Remove plaintext password/local fake registration.
3. Align Supabase tables with canonical domain model.
4. Persist accounts/finance profiles/categories/goals/transactions/allocations.

### Phase 5 — Offline sync
1. Introduce local database/store (prefer IndexedDB for structured/offline data rather than one large localStorage blob).
2. Add sync outbox, operation IDs, server timestamps/versioning and idempotent writes.
3. Resolve conflicts by entity/operation rules.
4. Test offline → edits → reconnect → multi-device synchronization.

### Phase 6 — Analytics and currency
1. Implement base-currency conversion while preserving original transaction currency.
2. Build derived monthly analytics from transaction ledger only.
3. Build ARISE-specific interactive charts.
4. Add filters and completed-goal history.

### Phase 7 — UI polish / production
1. Split monolithic `index.html` into modules/styles even if remaining vanilla JS.
2. Human error handling and loading/sync states.
3. Mobile-first UX pass.
4. Production tests, migrations, backup/recovery and deployment cleanup.

## Recommended immediate engineering structure
Avoid a framework rewrite solely for its own sake. First separate responsibilities, e.g.:
- `src/domain/finance-engine.js`
- `src/domain/statistics.js`
- `src/domain/goals.js`
- `src/domain/currency.js`
- `src/storage/local-store.js`
- `src/storage/sync.js`
- `src/services/supabase.js`
- `src/ui/*`
- `styles/*`
- `tests/finance-engine.test.js`

The existing visual shell can then be migrated incrementally instead of rewritten blindly.

## Definition of MVP-ready core
Do not call the product financially reliable until these are true:
- exact conservation of money for every accepted plan;
- no magic category names;
- goal balances trace to real money operations;
- reserve balance traceable to operations;
- overspend/uncontrolled portion is recorded explicitly;
- cross-currency statistics are correct;
- multi-profile isolation is tested;
- offline writes survive and synchronize without duplication;
- authentication is real and plaintext passwords are gone;
- financial engine has deterministic automated tests.
