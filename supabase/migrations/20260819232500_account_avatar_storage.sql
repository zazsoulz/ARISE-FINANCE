-- Private account avatar storage. Files live under <auth.uid()>/avatar.ext.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('arise-avatars','arise-avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists arise_avatar_select_own on storage.objects;
create policy arise_avatar_select_own on storage.objects
for select to authenticated
using (bucket_id='arise-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists arise_avatar_insert_own on storage.objects;
create policy arise_avatar_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='arise-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists arise_avatar_update_own on storage.objects;
create policy arise_avatar_update_own on storage.objects
for update to authenticated
using (bucket_id='arise-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='arise-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists arise_avatar_delete_own on storage.objects;
create policy arise_avatar_delete_own on storage.objects
for delete to authenticated
using (bucket_id='arise-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
