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

## Production-подключение

1. Создай проект Supabase.
2. Выполни `supabase/schema.sql` в SQL Editor.
3. Включи Email, Phone, Google и Apple providers в Supabase Auth.
4. Скопируй `config.example.js` в `config.js` и укажи URL и anon key.
5. Подключи `config.js` перед основным script в `index.html`.
6. Для production лучше перенести sync функций из localStorage в Supabase queries.
7. Для актуальных валютных курсов используй серверный endpoint/cron, а не доверяй клиентскому API.

## Важно

Текущий ZIP специально сохраняет рабочую offline-first модель: если Supabase не настроен, данные остаются на устройстве. Это позволяет продолжать UI/UX разработку без блокировки на backend.

Следующий production-этап: вынести состояние из localStorage в Supabase, синхронизировать профили/цели/операции/распределения и добавить реальное переключение финансовых профилей.

<!-- verification retrigger -->
