# ARISE FINANCE — Consolidation status (2026-08-22)

This note records the post-PR-#100 runtime consolidation state so the next compatibility-shell work is based on the actual `main`, not on older audit wording.

## Current `main`

`main` is at `3157cafb18b1434b6f71cc0947b780ebc82ccc45` after the modal-accessibility consolidation.

The following transition-era presentation/runtime layers have already been physically consolidated into canonical modules and must not be reintroduced as standalone runtime files:

- `arise-v3-state.css` → canonical product visual layer;
- `analytics-chart-accessibility.css` → `analytics-ui.css`;
- `analytics-expense-ui.js`, completed-goal analytics UI and reserve-runway UI → `analytics-ui.js`;
- `canonical-ui-overrides.js` → `product-rules.js`;
- `history-expense-edit-hook.js` and create-expense reconciliation UI → `expense-edit-ui.js`;
- goal history and future-reroute UI → `goal-lifecycle-ui.js`;
- reserve history drill-down → `reserve-lifecycle-ui.js`;
- stale/backdated FX disclosure → `currency-display.js`;
- category-setting consequences, income-plan consequences, screen-state behavior and modal accessibility → `product-ui.js`;
- settings base-currency guard → `profile-lifecycle.js`;
- duplicate `supabase-config.js` has been retired in favor of `supabase-public-config.js`.

Production now loads three canonical CSS files: `arise-v3.css`, `analytics-ui.css`, and `product-ui.css`. The production runtime manifest is protected by CI for file existence, syntax, duplication, and critical financial boot order.

## Remaining compatibility-shell work

The major remaining historical artifact is `app-shell.html`. It still contains the legacy financial block and eager initialization text that `index.html` strips before execution. Runtime-integrity checks fail closed if that stripping contract is violated, so this is safe today but should not be the final physical architecture.

The next shell-consolidation work should therefore be incremental, with one responsibility extracted or retired at a time and production-manifest smoke kept green. Do not attempt a wholesale rewrite of `app-shell.html` in one PR.

Recommended next candidates, in order of safety:

1. map the remaining shell-owned render/global functions to the canonical external modules and identify truly dead duplicates;
2. retire one shell-owned duplicate renderer only when a production-manifest smoke test proves the external renderer fully replaces it;
3. keep registration/bootstrap boundaries unchanged until account/auth and financial boot smoke tests remain green after extraction;
4. only after those steps, reduce the strip-by-marker compatibility contract itself.

## Beta blockers unchanged

This consolidation work does not close the operational P0 items in `docs/ARISE_AUDIT.md`:

- real two-device Supabase sync rehearsal;
- isolated migration replay plus backup/restore rehearsal;
- enable Supabase leaked-password protection and repeat auth/security checks.

Vercel remains intentionally outside the active development and verification loop until beta/production stability.
