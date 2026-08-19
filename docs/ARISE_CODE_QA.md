# ARISE FINANCE — Whole-App Code QA

Status: static code audit against `docs/ARISE_SPEC.md`. Runtime/browser-only items are explicitly marked.

## Executive verdict

ARISE has a strong visual prototype and a useful product shell, but it is not production-ready yet. The highest-risk issues are financial-state correctness, insecure local auth, goal funding that is not fully tied to conserved money flows, mixed-currency aggregation, duplicate/legacy financial calculations, and offline/sync architecture that is still localStorage-only.

## Priority findings

### P0 — must be fixed before production

1. **Plaintext password persistence** — `defaultState()` and `registerAccount()` store `account.password` in application state/localStorage. This conflicts with the canonical auth requirement. Replace with Supabase Auth; never persist plaintext passwords client-side.
2. **Financial engine still duplicated/embedded** — `calculateIncomePlan`, `validatePlan`, transaction/stat functions and UI code live in the same monolithic file and can drift. Extract one shared financial engine and make UI/statistics consume it.
3. **Monthly category/reserve limits are not reliably cumulative** — current allocation logic applies category/reserve limits against a single calculation rather than proving remaining monthly allowance across prior transactions. Limits must use month-to-date allocations.
4. **Goal balances are not yet guaranteed by conserved financial operations** — goal funding/progress must map to real allocations/transfers. No direct mutation of goal progress without a corresponding financial operation.
5. **Mixed-currency statistics are unsafe** — transactions preserve currency but aggregate views can sum values without a canonical conversion layer. Statistics must convert into profile base currency while retaining original transaction currency.

### P1 — major product-flow/domain issues

6. **Default categories do not match canon** — current default profile includes `Жизнь` and `Творчество`; canonical starter categories are `Обязательные расходы`, `Семья`, `Свободные деньги`, with reserve separate.
7. **System remainder/free financial room must never depend on category names** — all accounting must be ID/system-field based. A user category named `Свободные деньги` remains ordinary.
8. **Reserve is visually separate but not yet a full ledger entity** — reserve needs current balance, target, progress, contribution history and runway calculation derived from real financial operations.
9. **Uncontrolled expense flow needs explicit accounting** — expenses exceeding controlled free funds should record the unexplained portion as uncontrolled/untracked funds and explain it to the user instead of silently forcing another category negative.
10. **Settings/account/profile concerns are mixed** — account identity/auth and financial profile settings must remain separate in data and UI. Avatar is account-level; financial settings are profile-level.
11. **Current auth screen is registration-only local UI** — login/logout/recovery/provider auth are not production auth yet.
12. **Offline-first is incomplete** — localStorage provides single-device offline behavior, not durable offline-first sync. Add stable IDs, outbox, idempotency/conflict metadata, and Supabase synchronization.
13. **Analytics are derived inconsistently from legacy/current fields** — canonical source must be transactions/allocations; monthly statistics are derived only.
14. **History and completed goals are not yet a full historical model** — completed goals need archived history, duration, contribution trail, forecast-vs-actual and post-completion rerouting.

### P2 — UX / visual / maintainability

15. **No coherent icon system yet** — use one icon family/style across nav, actions, status and finance entities. Avoid mixed text-symbol/Unicode treatment.
16. **Charts are visually prototype-level** — current bar-style charts are generic. Replace with interactive ARISE-specific visualizations that explain cash flow, month comparison, goal trajectory and reserve runway.
17. **Animation language is only partially semantic** — retain subtle transitions, but tie animation to financial state changes: allocation appearing, goal progress, reserve runway change, sync state, completion.
18. **Monolithic `index.html` is high-risk** — UI, state, financial math, storage and analytics are coupled. Split incrementally without framework rewrite.
19. **Human error states are inconsistent** — standardize loading/empty/error/success states and ensure every visible action has a real handler and outcome.
20. **Runtime mobile/accessibility verification still required** — static CSS is mobile-aware, but touch targets, keyboard focus, modal behavior, scrolling and responsive charts need browser/device checks.

## Screen-by-screen status

| Screen / flow | Status | Notes |
|---|---|---|
| Registration | PARTIAL | UI works locally; production auth/security not implemented. |
| Account/topbar | PARTIAL | Identity UI exists; account/auth separation still incomplete. |
| Profile switcher | PARTIAL | Multi-profile shell exists; backend isolation/sync not implemented. |
| Home | PARTIAL | Useful summary shell; depends on financial-core correctness. |
| Income | PARTIAL | Add/proposal flow exists; engine and monthly-limit correctness need repair. |
| Income proposal/editor | FAIL for production | Financial conservation/remainder behavior must be centralized and tested. |
| Expenses | PARTIAL | CRUD exists; uncontrolled-source accounting needs canonical handling. |
| Goals | PARTIAL | UI exists; money-flow integrity/history/completion rerouting incomplete. |
| History/month navigation | PARTIAL | Present, but depends on unified source-of-truth calculations. |
| Analytics | PARTIAL | Useful prototype; mixed currencies and chart quality not production-ready. |
| Settings | PARTIAL | Many controls exist; account/profile/backend responsibilities need separation. |
| Reserve | PARTIAL | Configuration exists; full balance/runway ledger not yet implemented. |
| Import/export | PARTIAL | Useful local backup; migration/version validation needs hardening. |
| Offline/sync | FAIL for production | localStorage-only, no real multi-device sync/conflict handling. |

## Button/control audit rule

Static inspection shows handlers are bound for the main user actions (navigation, income, expense, goal create/edit/fund, profile settings, categories, reserve and profile switching). Before release, each visible control must pass an end-to-end browser test: handler exists, required DOM nodes exist, persistence occurs, state is correct, rerender is correct, cancel/delete paths are coherent, and no button is decorative-only.

## Top remediation order

1. Extract and test one financial engine.
2. Fix remainder/free-money semantics.
3. Make monthly category/reserve limits cumulative.
4. Tie goals to real allocations/transfers.
5. Implement reserve balance/history/runway.
6. Fix uncontrolled expense accounting.
7. Make all analytics transaction-derived.
8. Add currency conversion layer for RUB/EUR/USD.
9. Remove plaintext password/local fake auth.
10. Implement Supabase Auth and account/profile persistence.
11. Add IndexedDB/outbox/offline sync metadata.
12. Harden import/export migrations.
13. Complete goal history/completion rerouting.
14. Add full history filters.
15. Standardize screen states and human errors.
16. Establish one icon system.
17. Upgrade charts/diagrams to ARISE-specific interactive visualizations.
18. Split `index.html` into domain/storage/service/UI modules.
19. Add browser/mobile/accessibility test harness.
20. Production regression pass before deployment.

## Safe incremental refactor plan

Do not rewrite the app framework now. Extract in this order:

- `src/domain/financial-core.js` — allocation, validation, exact rounding, month-limit logic.
- `src/domain/goals.js` — forecasts, completion, transfer/rerouting rules.
- `src/domain/statistics.js` — transaction-derived month/history analytics.
- `src/domain/currency.js` — base/original currency conversion.
- `src/storage/local-store.js` — local persistence/migrations.
- `src/storage/sync.js` — outbox/idempotency/conflicts.
- `src/services/supabase.js` — auth/database boundary.
- `src/ui/*` — screen rendering/bindings only; no financial calculations.

## Visual/UI backlog

Preserve premium minimalism: deep dark surfaces, pastel rich accents, restrained blur/glass, soft depth and careful typography. Add a unified vector icon set; clear active/disabled/loading/success/error states; semantic micro-animations; richer goal and reserve progress visualizations; interactive monthly trend views; cash-flow/allocation diagrams; responsive mobile navigation; and visually distinct but consistent charts rather than generic repeated bar charts.

## Regression scenarios required

At minimum automate: multiple incomes in one month; fixed allocations before percentages; integer percentage validation 1–100; exact conservation/rounding; cumulative monthly limits; reserve enabled/disabled/limited; arbitrary category names including `Свободные деньги`; positive system remainder; rejected over-allocation; controlled and uncontrolled expenses; category deletion/rename; profile isolation; goal funding/target edits/completion/rerouting; completed-goal history; month boundaries; import of legacy state; RUB/EUR/USD mixed transactions; offline queued writes; duplicate-sync prevention.

## Runtime verification still required

This audit is static. Browser/runtime validation is still required for modal lifecycle, null DOM access, responsive layout, touch targets, keyboard focus, file/avatar handling, import/export UX, chart interactions, animation performance, persistence after refresh, profile switching, and eventual Supabase/offline synchronization.