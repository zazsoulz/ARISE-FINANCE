# ARISE FINANCE — Beta Sign-off Playbook

This playbook defines the operational checks that must pass before ARISE reintroduces Vercel as a release dependency or is treated as beta-ready.

It is intentionally separate from unit/regression tests: these scenarios verify the live Supabase/auth/sync/recovery path using disposable or beta data. Do not run destructive steps against the only production copy of financial data.

## Preconditions

- Use the current `main` commit and the canonical runtime manifest from `index.html`.
- GitHub Actions must be green before starting.
- Use a dedicated beta/disposable Supabase environment for migration replay and destructive recovery testing.
- Use two distinct browser/device storage contexts (Device A and Device B). A normal window + private window is acceptable only if storage/session isolation is confirmed.
- Use a dedicated test account and financial profile containing recognizable fixture data.
- Record commit SHA, Supabase project/environment, test account, test time, and result for every rehearsal.
- Do not use Vercel as the validation gate for these checks.

## Fixture

Create one test account with one financial profile and the following recognizable data:

- Category `Обязательное` — fixed allocation.
- Category `На жизнь` — percentage allocation.
- Active goal `Beta goal` with a non-zero target.
- Reserve enabled with a target.
- At least two income transactions in different months.
- At least two expenses, including one category-backed expense.
- One transaction in a non-base currency with an immutable FX snapshot.

Before conflict scenarios, verify both devices show identical balances, transaction counts and stable entity IDs after sync.

---

## 1. Two-device sync matrix

### 1.1 Offline edit → reconnect

1. Open the same profile on A and B and confirm both are synchronized.
2. Put A offline.
3. On A, edit an existing category and add one new expense.
4. Reload A while still offline and verify both local changes remain visible.
5. Restore network on A and trigger sync.
6. Sync B.

**Pass criteria**

- A keeps all local changes through offline reload.
- Outbox mutations survive until acknowledged.
- B receives the category edit and new expense after sync.
- Transaction/entity stable IDs do not change.
- No duplicate expense appears on either device.
- Final ledger totals match on A and B.

### 1.2 Concurrent edit of the same entity

1. Start synchronized on A and B.
2. Put A offline.
3. Edit the same category on A and B to different values.
4. Sync B first.
5. Reconnect and sync A.

**Pass criteria**

- ARISE reports an explicit conflict instead of silently overwriting either version.
- Stale local write is not pushed automatically.
- Conflict UI offers local and server versions.
- Choosing either version resolves the conflict deterministically.
- After final sync, A and B converge to the selected value.

Run this twice: once choosing the local version and once choosing the server version.

### 1.3 Delete vs edit

Run both directions:

- A deletes a category while B edits it.
- A edits a goal while B deletes it.

**Pass criteria**

- Delete/edit collision becomes an explicit conflict.
- No entity silently resurrects after a later pull.
- No entity disappears without an explicit chosen resolution.
- Tombstone/outbox state clears only after the selected server result is acknowledged.

### 1.4 Ambiguous network failure / idempotent retry

1. Create a new income or expense on A.
2. Force or simulate a network interruption after the remote write may have succeeded but before local acknowledgement completes.
3. Confirm the mutation remains queued/retriable locally.
4. Restore network and retry sync.

**Pass criteria**

- Retry reuses stable identity / mutation identity.
- Exactly one remote transaction exists.
- Exactly one local transaction exists.
- Mutation is acknowledged and removed only after successful reconciliation.
- Ledger balance does not change twice.

### 1.5 Profile isolation

1. Create two finance profiles under the same account.
2. Modify categories/goals/transactions in Profile A while B is selected on the second device.
3. Sync both devices and switch profiles repeatedly.

**Pass criteria**

- No category, goal, transaction, reserve setting or balance crosses profile boundaries.
- Remote rows remain associated with the correct `profile_id`.
- Local vault state remains isolated per profile.

---

## 2. Auth and recovery rehearsal

### 2.1 Sign-in/session/logout

Verify on both devices:

- Email/password sign-in succeeds.
- Session survives normal reload.
- Logout removes authenticated access without deleting local financial data unexpectedly.
- Signed-out UI clearly identifies local-only state.

### 2.2 Password recovery

1. Request password recovery for the beta account.
2. Complete the recovery link in a clean browser context.
3. Set a new password.
4. Sign in with the new password on both devices.

**Pass criteria**

- Recovery flow completes without exposing/storing plaintext passwords.
- Existing server financial data remains accessible after re-authentication.
- Local data reconnects to the same account identity rather than creating a second vault.

### 2.3 Leaked-password protection

Before beta sign-off:

- Enable Supabase Auth leaked-password / compromised-password protection.
- Re-run Supabase Security Advisor.

**Pass criteria**

- The `Leaked Password Protection Disabled` warning is gone.
- No new critical Auth or RLS warning appears.

---

## 3. RLS ownership verification

Using the beta account and a second unrelated account:

1. Capture IDs for both accounts' finance profiles and child rows.
2. Attempt normal client reads/updates/deletes across account boundaries.
3. Repeat for `finance_profiles`, `finance_categories`, `finance_goals`, `finance_transactions`, allocation/receipt tables where applicable.

**Pass criteria**

- Cross-account reads return no protected data.
- Cross-account writes/deletes fail.
- Owner account retains expected CRUD access.
- No browser client path requires a service-role key.

---

## 4. Migration replay rehearsal

Run only against a disposable/beta database.

1. Create an empty database/environment.
2. Apply repository migrations in repository order from scratch.
3. Verify all migrations complete without manual edits.
4. Run schema inspection for canonical `finance_*` tables, constraints, indexes and RLS policies.
5. Seed the standard beta fixture and run the application against that environment.

**Pass criteria**

- Fresh replay completes from zero state.
- Canonical tables, columns, constraints, indexes and policies match application expectations.
- Application can create/read/update/sync fixture data with no compatibility-table dependency.
- No migration requires rewriting previously applied production history.

If live migration timestamps differ from repository filename timestamps, record the mapping; do not rewrite already-applied production migration history solely to make timestamps match.

---

## 5. Backup and restore rehearsal

Run on the disposable/beta environment.

1. Populate the standard fixture plus at least one archived finance profile.
2. Create a database backup/snapshot using the supported Supabase/Postgres mechanism for the environment.
3. Record expected counts and stable IDs for profiles, categories, goals and transactions.
4. Restore into a clean disposable environment/database.
5. Point a clean ARISE client at the restored environment.
6. Sign in and pull data.

**Pass criteria**

- Expected row counts and stable IDs are preserved.
- Transaction-derived balances before and after restore are identical.
- Archived profiles remain recoverable.
- FX snapshot metadata remains unchanged.
- Sync can resume after restore without duplicating existing entities.
- No local-only compatibility workaround is required to recover canonical data.

---

## 6. Standalone product verification

Use the canonical manifest-based standalone preview artifact, not a divergent hand-maintained page.

Check at minimum:

- Mobile narrow viewport.
- Tablet/medium viewport.
- Desktop wide viewport.
- Keyboard-only navigation.
- Reduced-motion preference.
- Offline reload after prior successful boot.

Verify every primary action:

- Main navigation: Главная / Распределение / Цели / История / Аналитика.
- Add income.
- Add expense.
- Create/edit goal.
- Reserve actions.
- Profile/settings entry.
- Sync retry/conflict action.
- Empty-state CTAs.
- Transaction/history inspector.
- Modal close by button, backdrop and Escape where applicable.

**Pass criteria**

- No dead primary button.
- No blank screen.
- No horizontal layout break at supported widths.
- Focus is visible and returns correctly after modal close.
- Reduced-motion mode removes non-essential continuous motion.
- Core financial values shown in UI match ledger-derived values.

---

## 7. Sign-off record

Record one row per completed rehearsal:

| Check | Commit SHA | Environment | Date | Result | Notes/evidence |
| --- | --- | --- | --- | --- | --- |
| Two-device sync matrix |  |  |  |  |  |
| Auth/recovery |  |  |  |  |  |
| Security/RLS advisor |  |  |  |  |  |
| Migration replay |  |  |  |  |  |
| Backup/restore |  |  |  |  |  |
| Standalone mobile/desktop |  |  |  |  |  |

## Beta gate

ARISE may be treated as beta-ready only when all rows above are `PASS`, GitHub Actions remains green on the sign-off commit, and no unresolved P0 remains in `docs/ARISE_AUDIT.md`.

Vercel may be reintroduced after this gate as a release/deployment surface; it is not part of the correctness proof itself.
