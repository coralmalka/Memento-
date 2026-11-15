-- Memento social upgrade, 2026-11-15
-- Apply ONCE in your Supabase SQL editor. Does not delete existing data.
-- Requires existing public.posts, stories, profiles, post_likes, post_comments,
-- notifications, and direct_messages tables.

alter table public.direct_messages
  add column if not exists audio_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-voice', 'dm-voice', false, 10485760, array['audio/mp4','audio/m4a'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760,
      allowed_mime_types = array['audio/mp4','audio/m4a'];

-- Storage path: sender-user-uuid/random-name.m4a
-- Only the sender can upload or remove their own recordings.
drop policy if exists "memento_voice_insert" on storage.objects;
create policy "memento_voice_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dm-voice' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "memento_voice_select" on storage.objects;
create policy "memento_voice_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'dm-voice' and exists (
    select 1 from public.direct_messages m
    where m.audio_path = name
      and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
  ));
drop policy if exists "memento_voice_delete" on storage.objects;
create policy "memento_voice_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dm-voice' and (storage.foldername(name))[1] = auth.uid()::text);

-- Create notifications on the database server. RLS policies for clients
-- remain unchanged; SECURITY DEFINER is restricted to a fixed search path.
create or replace function public.memento_notify_social_event()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  mention record;
  content text;
  author_name text;
begin
  if TG_TABLE_NAME = 'post_likes' then
    select p.author_id into target_id from public.posts p where p.id = new.post_id;
    if target_id is not null and target_id <> new.user_id then
      insert into public.notifications(recipient_id,actor_id,type,body)
      values(target_id,new.user_id,'like','liked your post');
    end if;
  elsif TG_TABLE_NAME = 'post_comments' then
    select p.author_id into target_id from public.posts p where p.id = new.post_id;
    if target_id is not null and target_id <> new.author_id then
      insert into public.notifications(recipient_id,actor_id,type,body)
      values(target_id,new.author_id,'comment','commented on your post');
    end if;
    content := new.body;
  elsif TG_TABLE_NAME = 'stories' then
    if new.published_at is null then return new; end if;
    content := new.caption;
  else
    return new;
  end if;

  if content is not null and content like '%@%' then
    for mention in
      select distinct lower(hit[1]) as handle
      from regexp_matches(content, '@([A-Za-z0-9_]{3,24})', 'g') as hits(hit)
    loop
      select p.id into target_id from public.profiles p
      where lower(p.username) = mention.handle limit 1;
      if target_id is not null and target_id <> new.author_id then
        insert into public.notifications(recipient_id,actor_id,type,body)
        values(target_id,new.author_id,'mention',
          case when TG_TABLE_NAME = 'stories'
            then 'mentioned you in a story'
            else 'mentioned you in a comment' end);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists memento_post_liked_notification on public.post_likes;
create trigger memento_post_liked_notification after insert on public.post_likes
  for each row execute function public.memento_notify_social_event();
drop trigger if exists memento_post_comment_notification on public.post_comments;
create trigger memento_post_comment_notification after insert on public.post_comments
  for each row execute function public.memento_notify_social_event();
drop trigger if exists memento_story_mentions_notification on public.stories;
create trigger memento_story_mentions_notification after insert on public.stories
  for each row execute function public.memento_notify_social_event();
