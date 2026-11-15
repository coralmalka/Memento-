-- Memento profile upgrade: display name, identity, and real profile photos.
-- Additive and repeatable. Does not delete user profiles, posts, or existing media.
-- Run from the Supabase SQL Editor using the Memento project.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists category text;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists avatar_path text;

-- Profile pictures (not AI avatars) are public by design so any member can
-- see their friend's picture. Post/Story uploads remain in their own buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars','profile-avatars',true,5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Users can upload and remove only their own pictures (user UUID/path).
drop policy if exists "memento_profile_picture_insert" on storage.objects;
create policy "memento_profile_picture_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "memento_profile_picture_delete" on storage.objects;
create policy "memento_profile_picture_delete" on storage.objects
for delete to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- The bucket itself is public, and signed-in users can also read its files.
drop policy if exists "memento_profile_picture_select" on storage.objects;
create policy "memento_profile_picture_select" on storage.objects
for select to authenticated
using (bucket_id='profile-avatars');

-- Profile UPDATE permission continues to come from your existing profiles RLS.
