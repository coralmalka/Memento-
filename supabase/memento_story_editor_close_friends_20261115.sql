-- Run in Supabase SQL Editor AFTER the existing social/audio migrations.
-- Transactional and repeatable. No existing stories, photos or friends are deleted.
begin;

create table if not exists public.close_friends (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,friend_id),
  check(owner_id<>friend_id)
);
alter table public.close_friends enable row level security;
grant select,insert,delete on public.close_friends to authenticated;
drop policy if exists memento_close_friends_owner on public.close_friends;
create policy memento_close_friends_owner on public.close_friends for all to authenticated
  using(owner_id=auth.uid()) with check(owner_id=auth.uid());
-- Even an older broad policy must not expose or edit someone else's list.
drop policy if exists memento_close_friends_guard on public.close_friends;
create policy memento_close_friends_guard on public.close_friends as restrictive for all to public
  using(owner_id=auth.uid()) with check(owner_id=auth.uid());

alter table public.stories add column if not exists audience text not null default 'public';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='memento_story_audience' and conrelid='public.stories'::regclass) then
    alter table public.stories add constraint memento_story_audience check(audience in ('public','close_friends'));
  end if;
end $$;

-- Uses auth.uid(), never an arbitrary caller-supplied viewer ID.
create or replace function public.memento_is_close_friend(owner uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.close_friends where owner_id=owner and friend_id=auth.uid()); $$;
revoke all on function public.memento_is_close_friend(uuid) from public;
grant execute on function public.memento_is_close_friend(uuid) to authenticated, anon;

alter table public.stories enable row level security;
drop policy if exists memento_close_story_read on public.stories;
create policy memento_close_story_read on public.stories for select to authenticated using(
  audience='close_friends' and (author_id=auth.uid() or (
    published_at is not null and published_at<=now() and expires_at>now() and public.memento_is_close_friend(author_id)
  ))
);
-- Restrictive AND guard prevents old public-story or public-collection policies
-- from granting access to a Close Friends story.
drop policy if exists memento_story_audience_guard on public.stories;
create policy memento_story_audience_guard on public.stories as restrictive for select to public using(
  audience='public' or author_id=auth.uid() or (
    auth.uid() is not null and published_at is not null and published_at<=now() and expires_at>now()
    and public.memento_is_close_friend(author_id)
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('memento-close-friends','memento-close-friends',false,20971520,
 array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','audio/mp4','audio/wav','audio/aac'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.memento_can_read_close_media(object_name text)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select auth.uid() is not null and (
   split_part(object_name,'/',2)=auth.uid()::text or exists(
     select 1 from public.stories s where s.audience='close_friends'
       and (s.image_path=object_name or s.original_audio_path=object_name)
       and s.published_at is not null and s.published_at<=now() and s.expires_at>now()
       and public.memento_is_close_friend(s.author_id)
   )
 );
$$;
revoke all on function public.memento_can_read_close_media(text) from public;
grant execute on function public.memento_can_read_close_media(text) to authenticated, anon;

drop policy if exists memento_close_media_read on storage.objects;
create policy memento_close_media_read on storage.objects for select to authenticated
 using(bucket_id='memento-close-friends' and public.memento_can_read_close_media(name));
drop policy if exists memento_close_media_read_guard on storage.objects;
create policy memento_close_media_read_guard on storage.objects as restrictive for select to public
 using(bucket_id<>'memento-close-friends' or (auth.uid() is not null and public.memento_can_read_close_media(name)));
drop policy if exists memento_close_media_insert on storage.objects;
create policy memento_close_media_insert on storage.objects for insert to authenticated
 with check(bucket_id='memento-close-friends' and split_part(name,'/',1)='close-friends' and split_part(name,'/',2)=auth.uid()::text);
drop policy if exists memento_close_media_insert_guard on storage.objects;
create policy memento_close_media_insert_guard on storage.objects as restrictive for insert to public
 with check(bucket_id<>'memento-close-friends' or (split_part(name,'/',1)='close-friends' and split_part(name,'/',2)=auth.uid()::text));
drop policy if exists memento_close_media_update_guard on storage.objects;
create policy memento_close_media_update_guard on storage.objects as restrictive for update to public
 using(bucket_id<>'memento-close-friends') with check(bucket_id<>'memento-close-friends');
drop policy if exists memento_close_media_delete on storage.objects;
create policy memento_close_media_delete on storage.objects for delete to authenticated
 using(bucket_id='memento-close-friends' and split_part(name,'/',2)=auth.uid()::text);
drop policy if exists memento_close_media_delete_guard on storage.objects;
create policy memento_close_media_delete_guard on storage.objects as restrictive for delete to public
 using(bucket_id<>'memento-close-friends' or split_part(name,'/',2)=auth.uid()::text);

-- Enforce private media routing and prevent public reposts even with a modified client.
create or replace function public.memento_guard_private_story()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare source_id uuid;
begin
  if TG_TABLE_NAME='stories' then
    if TG_OP='UPDATE' and old.audience='close_friends' and
       (new.audience<>old.audience or new.author_id<>old.author_id or new.image_path<>old.image_path
        or new.original_audio_path is distinct from old.original_audio_path) then
      raise exception 'Close Friends story media and audience cannot be changed.';
    end if;
    if new.audience='close_friends' then
      if new.image_path is null or new.image_path not like 'close-friends/'||new.author_id::text||'/%'
        or (new.original_audio_path is not null and new.original_audio_path not like 'close-friends/'||new.author_id::text||'/%') then
        raise exception 'Close Friends photos and audio must use private story storage.';
      end if;
    elsif new.image_path like 'close-friends/%' or new.original_audio_path like 'close-friends/%' then
      raise exception 'Private story media cannot be published publicly.';
    end if;
    source_id:=new.source_story_id;
  elsif TG_TABLE_NAME='posts' then
    if new.image_path like 'close-friends/%' or new.original_audio_path like 'close-friends/%' then
      raise exception 'Private story media cannot be reused in posts.';
    end if;
    source_id:=new.source_story_id;
  elsif TG_TABLE_NAME='collections' then
    if new.cover_path like 'close-friends/%' then raise exception 'Private story photos cannot be collection covers.'; end if;
  elsif TG_TABLE_NAME='collection_stories' then
    source_id:=new.story_id;
  elsif TG_TABLE_NAME='direct_messages' then
    source_id:=new.shared_story_id;
  end if;
  if source_id is not null and exists(select 1 from public.stories where id=source_id and audience='close_friends') then
    raise exception 'Close Friends stories cannot be reshared or added to collections.';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['stories','posts','collections','collection_stories','direct_messages'] loop
    execute format('drop trigger if exists memento_private_story_guard on public.%I',t);
    execute format('create trigger memento_private_story_guard before insert or update on public.%I for each row execute function public.memento_guard_private_story()',t);
  end loop;
end $$;
commit;
