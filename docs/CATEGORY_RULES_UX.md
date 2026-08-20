# Category rule UX contract

Category names are user content, never financial behavior. A user may rename, add, disable, or delete ordinary categories without changing system semantics by name.

The settings UI explains the effect of the rule currently being edited:

- **Fixed**: ARISE targets the configured fixed amount for the month.
- **Percentage**: ARISE applies the configured percentage to each new income; an optional monthly limit caps further automatic allocation for that month.
- **Remainder**: receives residual money after rules ahead of it have been serviced.
- **Priority**: controls ordering when available money cannot satisfy every rule; it does not manufacture extra money or guarantee funding.
- **Disabled**: stops future automatic allocation without rewriting historical transactions.

Only controls relevant to the selected rule type should be visually active. The consequence layer is explanatory only: it must not introduce a second planner or mutate the financial proposal.
