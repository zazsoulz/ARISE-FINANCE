# ARISE Finance — financial architecture

## Source of truth

`financial-core.js` is the source of truth for financial calculations. `financial-runtime.js` owns simple state mutations and legacy UI compatibility helpers. `financial-integration.js` connects the UI to the core. `financial-bootstrap.js` decides whether to render registration or the application after the financial runtime is ready.

`app-shell.html` still contains the historical inline financial block for source compatibility, but `index.html` removes that block and the old eager initialization before the shell is executed. The effective runtime therefore has one financial engine.

## Money invariants

1. Every unit of income must end in exactly one place: category allocation, reserve, goal allocation, or free remainder.
2. A positive remainder is valid and becomes free money. Over-allocation is invalid.
3. Category and reserve monthly limits are cumulative across multiple incomes in the same month.
4. Goal funding is a money movement. It must come from an actual account such as free money; changing a goal counter alone must never create value.
5. Goal allocations cannot exceed the amount remaining to the target.
6. Completed goals do not receive new automatic allocations. Their future allocation capacity is automatically released to lower-priority goals or free money.
7. Goal planning is deterministic and considers priority, deadline, remaining target, monthly contribution and funding already made in the current month.
8. Reserve is a ledger balance, not merely a lifetime statistic.
9. Legacy income records without `remainder` remain readable; remainder is reconstructed from income minus category allocations, goal allocations and reserve.
10. Simulation must not mutate profile state.

## Validation layers

GitHub Actions runs:

- JavaScript syntax checks for all runtime modules;
- financial regression tests;
- loader/bootstrap contract tests, including removal of the legacy engine from the effective shell;
- headless DOM smoke tests for registration, registered-app boot and goal-aware income planning.

Production deployment is intentionally outside this validation loop until the product model is complete enough for release testing.
