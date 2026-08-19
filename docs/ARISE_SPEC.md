# ARISE FINANCE — Canonical Product Specification

Status: source of truth for product behavior. Later explicit product decisions override older ones.

## 1. Product
ARISE is a personal financial system and assistant, not merely a budget calculator. It helps a user configure a financial system once, proposes a transparent plan for every income, records real operations, shows consequences of decisions, protects against unnoticed overspending, and teaches financial discipline without taking control away from the user.

Core loop: USER CONFIGURES SYSTEM → ARISE PROPOSES PLAN → USER REVIEWS/EDITS → PLAN IS APPLIED → TRANSACTIONS ARE STORED → ARISE CALCULATES REAL STATE → USER SEES CONSEQUENCES → SYSTEM IS ADJUSTED → GOALS ARE ACHIEVED.

## 2. Account vs financial profiles
One account may own multiple completely independent financial profiles.

Account contains only identity/access data: name, email, avatar, authentication/password management, notification preference. Avatar belongs to the account, not to a financial profile.

Each financial profile owns its own currency, income, expenses, categories, goals, reserve, distribution rules, history, statistics and financial settings. Profiles never mix data.

## 3. First launch
A new financial profile may start with editable example categories:
- Обязательные расходы
- Семья
- Свободные деньги

These are ordinary user categories, not reserved system identifiers. They may be renamed, deleted or replaced.

Reserve / Финансовая подушка is NOT a normal category. It is a separate system layer and may be disabled.

Optional example goals such as «Цель №1» / «Цель №2» may be offered, but real user goals start empty and templates must be trivially removable/editable.

## 4. Categories
Categories are user-defined. A category may include name, enabled state, allocation mode, integer percentage, fixed amount, priority, monthly limit and related financial settings.

Primary allocation modes for the canonical model are fixed and percentage. A system remainder must not be represented through a magic category type or a magic category name.

Percent values are whole numbers from 1 to 100. The UI may provide convenient presets such as 5, 6, 10, 14, 20, 25, 30, etc. No arbitrary fractional percentages such as 5.67%.

Monthly limits reset by month. When a category has reached its monthly limit, further automatic allocations to it stop for that month.

## 5. Reserve
Reserve is a separate financial layer. It may have enabled state, contribution rule, limit/target, current balance and target balance.

ARISE must show not only reserve amount/progress but also estimated financial runway: how many months the current reserve can sustain the user's current level of essential/living expenses if income stops.

ARISE never forces reserve contributions when the user has disabled them.

## 6. Goals
Goals are financial entities integrated into the allocation engine, not decorative counters.

A goal includes name, target amount, current amount, currency, priority, deadline, status, contribution history, forecast and allocation settings.

Goal progress must be traceable to real financial operations/allocations. Money must never appear in goal.current without a corresponding operation/allocation.

Changing target, deadline, priority or contribution behavior recalculates progress, forecast, required pace and future suggestions.

When a goal is completed, ARISE notifies the user and asks where future funds previously assigned to that goal should go: another category, another goal, reserve, free allocation, or a new destination. This rule is persisted.

When a goal is closed/deleted with money, money/history are not destroyed. ARISE asks where the balance should be moved or parks it in a clearly identified holding destination until the user decides.

Completed goals remain available with full history, duration, contributions, original vs actual forecast and completion method.

## 7. Income
Every real income is a separate transaction. There may be any number of incomes in a month.

Income fields: amount, date, original currency, optional source, optional note and stable unique ID.

Source is optional but recommended for analytics.

After income entry, ARISE immediately generates a proposal and visibly shows every destination and amount before the user applies it.

The user may manually change the proposal. ARISE explains consequences where meaningful (for example, goal completion moves later or reserve builds more slowly).

## 8. Distribution engine
There must be ONE financial allocation engine and one rounding/correction mechanism.

Conceptual order:
1. income
2. fixed commitments
3. monthly limits
4. goals / priorities / deadlines / required pace
5. percentage rules
6. reserve
7. exact rounding correction
8. final unallocated amount / free financial room

Priority must materially affect constrained/dynamic allocation, not merely ordering in the UI.

The engine must never allocate more than available income. User-facing errors must be human-readable.

Internal arithmetic must guarantee exact currency-unit conservation: no missing or invented ruble/euro/dollar unit after allocation. Display formatting and internal exact calculation are separate concerns.

## 9. «Свободные деньги» terminology
«Свободные деньги» may exist as an ordinary user-created/default-template category and therefore its NAME can never be used as a system key.

System-level unallocated remainder/free financial room, when needed by the engine, must be stored/calculated separately from categories and must never depend on a category being named «Свободные деньги».

The product UX may present free-to-spend money as money the user can spend without guilt while respecting their own plan, but implementation must distinguish the system value from any identically named user category.

## 10. Expenses and uncontrolled money
Every expense is a separate transaction with stable ID, amount, date, original currency, optional description/note and optional explicit funding source/category.

If no funding source is selected, ARISE may default the expense to the profile's free-to-spend pool according to the configured financial model.

If a user records an expense larger than the money that can be explained by controlled balances and does not identify another source, ARISE must record and explain the unexplained portion as uncontrolled/untracked income/funds rather than silently corrupting another category.

Example: 30,000 expense, only 20,000 controlled free funds available → 20,000 controlled + 10,000 from uncontrolled/untracked funds.

ARISE may be strict but not toxic: show that the user exceeded their own plan and offer to identify the true source or accept the uncontrolled portion.

## 11. History and analytics
Transactions are the source of truth. Statistics are derived, never manually maintained as a second financial truth.

Primary analytics unit is month, while every transaction remains individually inspectable.

History should support filtering by period/month, income/expense, category, goal, income source, expense source, currency, operation type and completed goals.

Analytics should cover income, expenses, allocations, categories, goals, reserve, overspending/uncontrolled funds, trends and month-to-month comparisons.

Charts should be interactive, dynamic and visually premium but must explain financial meaning rather than act as decoration.

## 12. Currency
Supported currencies: RUB, EUR, USD.

Each financial profile has a base currency. Every transaction permanently retains its original currency. Analytics may convert values using current/appropriate exchange rates without destroying original values.

## 13. Offline-first and sync
Mobile-first product. Core financial work must remain available offline: view data, add income/expenses, create/edit goals, edit settings/profiles.

Local changes are queued and synchronized when connectivity returns. Sync must protect against duplicates, lost writes, conflicts and wrong ordering. Every operation requires a stable unique ID and sync metadata.

Supabase provides production authentication, account/profile storage, financial data storage and synchronization, but normal UI actions must not require a live request for every click.

## 14. Authentication
Production authentication uses Supabase Auth or equivalent secure auth. Never store plaintext passwords in localStorage/application state.

Desired convenient methods may include email/password, Google, Apple and phone where technically/operationally appropriate. Account supports login/logout, password change/recovery and notification preferences.

## 15. UI principles
Premium minimalism: dark deep background, pastel rich accents, restrained blur/glass, soft shadows, careful typography, smooth meaningful transitions, mobile-first responsive layout.

Avoid visual noise, acidic colors, cheap gradients, excessive rounding and animation without semantic purpose.

Errors shown to users are human language. Technical stack traces stay in console/logging.

## 16. Architecture rules
- Account and finance profile are separate entities.
- Transactions/allocations are financial source of truth.
- Monthly statistics are derived.
- One allocation engine only.
- One rounding/currency-unit correction mechanism only.
- No magic category names.
- Reserve is separate from user categories.
- Goals must connect to real financial flows.
- UI rendering must not duplicate financial calculations.
- Local state and Supabase must represent the same domain model.
