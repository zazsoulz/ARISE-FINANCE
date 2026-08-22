# ARISE FINANCE — Consolidation status (2026-08-23)

This note records the current compatibility-shell state after the staged renderer-retirement series through PR #115, so physical cleanup is based on the actual `main` rather than older audit wording.

## Current `main`

`main` is at `d09c24fc69998cfaba3aea5c7b8b1d3c32fb5ded` after centralizing compatibility renderer retirement.

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

Production loads three canonical CSS files: `arise-v3.css`, `analytics-ui.css`, and `product-ui.css`. The production runtime manifest is protected by CI for file existence, syntax, duplication, and critical financial boot order.

## Canonical screen ownership is complete

The eight principal screen renderers now have canonical owners outside `app-shell.html`:

- `renderTopbar`, `renderNav`, `renderHome`, `renderIncome`, `renderGoals`, `renderHistory` → `arise-v3.js`;
- `renderAnalytics` → `analytics-ui.js`;
- `renderSettings` → `settings-ui.js`.

`index.html` currently removes the corresponding legacy copies from the effective compatibility runtime through one fail-closed retirement registry before canonical modules boot. This is safe at runtime, but the duplicate source still physically exists in `app-shell.html` and is now the main consolidation debt.

## Next compatibility-shell work

The next phase is physical source retirement, still incrementally rather than as a wholesale rewrite.

1. Physically remove one already-retired screen renderer from `app-shell.html` at a time.
2. Remove that renderer from `LEGACY_RENDERER_RETIREMENT` in the same change.
3. Keep canonical ownership assertions and production-manifest smoke green.
4. Preserve shared helpers that remain referenced by canonical modules (`incomeRow`, transaction/history helpers, modals, category editor and other compatibility utilities) until ownership is explicitly migrated.
5. After all eight duplicate screen renderers are physically gone, simplify or remove the retirement registry itself.
6. Only then tackle the larger legacy financial block / eager-initialization source removal and reduce the strip-by-marker loader contract.

The renderer-retirement regression contract is intentionally being changed to support this phase: it now requires every renderer still physically present to be listed in the retirement registry, while allowing a physically removed renderer only when its canonical external owner remains proven. This prevents tests themselves from forcing dead source to stay in the repository.

## Beta blockers unchanged

This consolidation work does not close the operational P0 items in `docs/ARISE_AUDIT.md`:

- real two-device Supabase sync rehearsal;
- isolated migration replay plus backup/restore rehearsal;
- enable Supabase leaked-password protection and repeat auth/security checks.

Vercel remains intentionally outside the active development and verification loop until beta/production stability.
