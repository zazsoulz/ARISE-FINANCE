-- Minimal local PostgreSQL compatibility objects for migration replay tests.
-- This is test-only scaffolding, not a replacement for Supabase platform services.

create extension if not exists pgcrypto;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')
$$;

grant usage on schema auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function storage.foldername(text) to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
