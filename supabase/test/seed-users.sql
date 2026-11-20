-- Existing auth users are inserted before canonical migrations to exercise backfill.
insert into auth.users(id,email,raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111','arise-owner-a@example.invalid','{"name":"Профиль A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222','arise-owner-b@example.invalid','{"name":"Профиль B"}'::jsonb)
on conflict (id) do nothing;
