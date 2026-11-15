-- Memento: richer public profiles (additive migration, does not delete users or posts).
-- Run once in Supabase SQL Editor BEFORE using the new Profile Editor.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists category text;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists tiktok text;
alter table public.profiles add column if not exists avatar_path text;

-- Profile photos are intentionally PUBLIC, like Instagram profile pictures.
-- Post images and Story archives remain in their existing private bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,5242880,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set public = true, file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

drop policy if exists "memento_avatar_upload" on storage.objects;
create policy "memento_avatar_upload" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "memento_avatar_delete" on storage.objects;
create policy "memento_avatar_delete" on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "memento_avatar_read" on storage.objects;
create policy "memento_avatar_read" on storage.objects for select to public
using (bucket_id='profile-avatars');

-- Existing profile RLS should already allow a user to update their own row.
-- No broad UPDATE policy is introduced here.
