-- Additional Memento setup: private original-audio uploads for posts and stories.
-- Additive migration. Does not alter or delete any existing rows.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'original-audio','original-audio',false,20971520,
  array['audio/mpeg','audio/mp4','audio/wav','audio/aac']
)
on conflict (id) do update
  set public=false,
      file_size_limit=20971520,
      allowed_mime_types=array['audio/mpeg','audio/mp4','audio/wav','audio/aac'];

drop policy if exists "memento_original_audio_insert" on storage.objects;
create policy "memento_original_audio_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='original-audio'
    and (storage.foldername(name))[1]=auth.uid()::text
  );

-- Listen to your own uploads or tracks attached to posts/stories you can view
-- under the existing post and story row-level-security policies.
drop policy if exists "memento_original_audio_select" on storage.objects;
create policy "memento_original_audio_select" on storage.objects
  for select to authenticated
  using (
    bucket_id='original-audio'
    and (
      (storage.foldername(name))[1]=auth.uid()::text
      or exists(select 1 from public.posts p where p.original_audio_path=name)
      or exists(select 1 from public.stories s where s.original_audio_path=name)
    )
  );

drop policy if exists "memento_original_audio_delete" on storage.objects;
create policy "memento_original_audio_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id='original-audio'
    and (storage.foldername(name))[1]=auth.uid()::text
  );
