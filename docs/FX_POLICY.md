# ARISE FINANCE — FX Snapshot Policy

Status: product/implementation policy subordinate to `docs/ARISE_SPEC.md`.

## Principle
Every foreign-currency transaction permanently keeps its original amount/currency and the base-currency conversion snapshot used when that transaction is saved. Historical records are never silently revalued by later exchange-rate changes.

## New transactions entered today
ARISE may use the current available rate book, including a disclosed cached rate while offline. The saved transaction keeps `originalAmount`, `originalCurrency`, `baseAmount`, `baseCurrency`, `exchangeRateToBase`, `fxSource`, and `fxFetchedAt` as its immutable conversion snapshot.

## Backdated transactions
A backdated operation is a new transaction whose selected transaction date is earlier than the current local date.

ARISE does not pretend that the current FX service is a historical-rate service. Until a verified historical-rate source is implemented, a backdated foreign-currency transaction uses the rate available at the moment of entry/save. The UI must explicitly disclose that the selected historical transaction date does not cause an automatic historical FX lookup.

The resulting snapshot is immutable in the same way as a transaction entered today. Later rate refreshes must not silently replace the saved snapshot.

## Imports
Imports must preserve an auditable conversion basis. Preferred import data contains original amount/currency plus either:

- an explicit base amount/base currency and exchange rate snapshot; or
- an explicit historical rate with source and timestamp that ARISE can store as the transaction snapshot.

If an import does not contain enough information to establish a trustworthy conversion and ARISE cannot obtain an appropriate verified rate, the import must remain pending/require user resolution rather than inventing a historical rate.

## Analytics
Ledger/history displays the original transaction value and its saved base-equivalent snapshot. Current-rate conversions may be shown as secondary analytical views, but they must not overwrite transaction truth.

## Future historical-rate support
If ARISE later integrates a historical FX provider, it may offer that rate before saving a new backdated transaction. The user-visible source/date must be clear, and accepting it creates a normal immutable FX snapshot. Existing transactions are not rewritten automatically.