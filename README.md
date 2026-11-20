# ARISE FINANCE

Полированный mobile-first прототип и основа production-версии финансового приложения.

## Уже реализовано в прототипе

- ARISE FINANCE visual system: тёмная пастельная палитра, blur, мягкие transitions, micro-interactions.
- Главная, Доходы, Расходы, Календарь, Цели, Что если?, Настройки.
- Onboarding с первичной настройкой.
- Несколько источников дохода.
- История операций по месяцам.
- Рекомендованный план распределения.
- Ручная корректировка плана перед подтверждением.
- Динамический приоритет целей.
- Прогресс целей и completed state.
- What-if сценарий без изменения реальных данных.
- Профили: с нуля / шаблон / копия.
- Скрытие сумм.
- Экспорт/импорт JSON.
- Архитектура Supabase auth/database и SQL-схема.
- Email/password, Google, Apple и phone UI/API hooks при наличии Supabase.

## Supabase schema and migration path

The current canonical backend uses the root `schema.sql` as a legacy-compatibility baseline, followed by the timestamped migrations in `supabase/migrations/`.

For a **new disposable project**:

1. Apply the root `schema.sql` once. It establishes the legacy `public.profiles` and `public.finance_profiles` baseline consumed by the first canonical migration.
2. Apply every file in `supabase/migrations/` in lexicographic timestamp order using the Supabase migration runner.
3. Follow `docs/ISOLATED_REPLAY_RESTORE_RUNBOOK.md` for the full beta replay, ownership/RLS, backup and restore gate.

Do not re-run the baseline against an active project, and never edit or reorder an already-applied migration. The CI `Supabase Migration Replay Smoke` workflow runs a disposable PostgreSQL 17 compatibility replay and dump/restore preflight; it is useful regression evidence but does **not** replace the real Supabase beta rehearsal tracked in issue #201.
## Важно

Текущий ZIP специально сохраняет рабочую offline-first модель: если Supabase не настроен, данные остаются на устройстве. Это позволяет продолжать UI/UX разработку без блокировки на backend.

Следующий production-этап: вынести состояние из localStorage в Supabase, синхронизировать профили/цели/операции/распределения и добавить реальное переключение финансовых профилей.
